
// functions/src/ai/transcribe-video.ts

import { GoogleGenAI, Part, FileState } from "@google/genai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Storage } from "@google-cloud/storage";

// Initialize the new GoogleGenAI class with the API key
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY as string);
const storage = new Storage();

const POLLING_INTERVAL_MS = 10000; // 10 seconds
const MAX_POLLING_ATTEMPTS = 60;   // 10 minutes max

/**
 * Downloads a video from GCS, uploads it to the Gemini File API,
 * generates a transcription, and cleans up all resources.
 * @param bucketName The name of the Google Cloud Storage bucket.
 * @param filePath The path to the video file within the bucket.
 * @returns A promise that resolves to the transcribed text.
 */
export async function transcribeVideo(bucketName: string, filePath: string): Promise<string> {
  const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));
  // The 'geminiFile' variable will hold the response from the File API upload
  let geminiFile;
  let fileUploadResponse;

  try {
    // Step 1: Download the file from GCS to a temporary local directory
    await storage.bucket(bucketName).file(filePath).download({ destination: tempFilePath });
    console.log(`Successfully downloaded file from GCS to temporary path: ${tempFilePath}.`);

    // Step 2: Upload the local file to the Gemini File API
    console.log(`Uploading ${tempFilePath} to the Gemini File API...`);
    fileUploadResponse = await genAI.uploadFile(tempFilePath);
    console.log(`Upload complete. File API Name: ${fileUploadResponse.name}, URI: ${fileUploadResponse.uri}`);
    
    // Step 2.5: Poll for ACTIVE state
    console.log(`Polling for file to become active. This may take a few minutes...`);
    let attempts = 0;
    let fileState: FileState | undefined;
    
    while(attempts < MAX_POLLING_ATTEMPTS) {
        // The get() method returns a promise that resolves to the file metadata
        if (fileUploadResponse.name === undefined) {
          throw new Error("File upload response name is undefined.");
        }
        const file = await genAI.getFile(fileUploadResponse.name);

        fileState = file.state;
        
        if (fileState === FileState.ACTIVE) {
          console.log(`File is now ACTIVE.`);
          geminiFile = file; // Store the final file object
          break;
        } else if (fileState === FileState.FAILED) {
            throw new Error(`File processing failed with state: ${fileState}`);
        }
        
        console.log(`Current file state: ${fileState}. Waiting ${POLLING_INTERVAL_MS / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
        attempts++;
    }

    if (!geminiFile || geminiFile.state !== FileState.ACTIVE) {
        throw new Error(`File did not become active after ${attempts * POLLING_INTERVAL_MS / 1000} seconds. Last state: ${fileState}`);
    }


    // Step 3: Generate content using the File API URI
    const prompt = "Please provide a detailed, verbatim transcription of the audio in this video file.";
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
    const result = await model.generateContent([prompt, {
      fileData: {
        mimeType: geminiFile.mimeType as string,
        fileUri: geminiFile.uri as string,
      }
    }]);
    
    const response = result.response;
    const transcription = response.text();

    console.log("Transcription generation completed successfully.");

    // Ensure transcription text is not undefined before returning
    if (transcription === undefined) {
      throw new Error("Transcription failed: No text was returned by the model.");
    }

    return transcription;

  } catch (error) {
    console.error("An error occurred in the transcribeVideo workflow:", error);
    // Propagate the error to the calling function for proper handling
    throw new Error(`Failed to transcribe video: ${error instanceof Error? error.message : String(error)}`);
  } finally {
    // Step 4: Clean up resources regardless of success or failure

    // Clean up the file from the Gemini File API
    const fileToClean = geminiFile || fileUploadResponse;
    if (fileToClean && fileToClean.name) {
      try {
        // The delete method requires the 'name' property from the upload response
        await genAI.deleteFile(fileToClean.name);
        console.log(`Successfully cleaned up file from File API: ${fileToClean.name}`);
      } catch (cleanupError) {
        // Log cleanup errors but don't let them hide the original error
        console.error(`Failed to clean up file from File API (${fileToClean.name}):`, cleanupError);
      }
    }

    // Clean up the temporary local file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`Successfully deleted temporary local file: ${tempFilePath}`);
    }
  }
}
