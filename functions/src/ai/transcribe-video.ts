// functions/src/ai/transcribe-video.ts - CORRECTED IMPLEMENTATION

// 1. Correct the import to use the new, recommended SDK
import { GoogleGenAI, Part } from "@google/genai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
// Assuming @google-cloud/storage is used for downloading the initial file
import { Storage } from "@google-cloud/storage";

// 2. Initialize the new GoogleGenAI class
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const storage = new Storage();

/**
 * Downloads a video from GCS, uploads it to the Gemini File API,
 * generates a transcription, and cleans up all resources.
 * @param bucketName The name of the Google Cloud Storage bucket.
 * @param filePath The path to the video file within the bucket.
 * @returns A promise that resolves to the transcribed text.
 */
export async function transcribeVideo(bucketName: string, filePath: string): Promise<string> {
  const fileName = path.basename(filePath);
  const tempFilePath = path.join(os.tmpdir(), fileName);
  let geminiFile;

  try {
    // Step 1: Download the file from GCS to a temporary local directory
    await storage.bucket(bucketName).file(filePath).download({
      destination: tempFilePath,
    });
    console.log(`Successfully downloaded file from GCS to temporary path: ${tempFilePath}.`);

    // Step 2: Upload the local file to the Gemini File API
    console.log(`Uploading ${tempFilePath} to the Gemini File API...`);
    geminiFile = await genAI.files.upload({
      file: tempFilePath,
    });
    console.log(`Upload complete. File API Name: ${geminiFile.name}, URI: ${geminiFile.uri}`);

    // 3. Generate content using the File API URI
    const model = genAI.models.get({ model: 'gemini-1.5-pro-latest' });
    const prompt = "Transcribe the audio from this video, including timestamps.";

    console.log("Requesting transcription from Gemini model...");
    const result = await (await model).generateContent([prompt, geminiFile]);
    const response = result.response;
    const transcription = response.text();
    console.log("Transcription generation completed successfully.");

    return transcription;

  } catch (error) {
    console.error("An error occurred in the transcribeVideo workflow:", error);
    // Propagate the error to the calling function for proper handling
    throw new Error(`Failed to transcribe video: ${error instanceof Error? error.message : String(error)}`);
  } finally {
    // Step 4: Clean up resources regardless of success or failure

    // Clean up the file from the Gemini File API
    if (geminiFile && geminiFile.name) {
      try {
        // The delete method requires the 'name' property from the upload response
        await genAI.files.delete({ name: geminiFile.name });
        console.log(`Successfully cleaned up file from File API: ${geminiFile.name}`);
      } catch (cleanupError) {
        // Log cleanup errors but don't let them hide the original error
        console.error(`Failed to clean up file from File API (${geminiFile.name}):`, cleanupError);
      }
    }

    // Clean up the temporary local file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`Successfully deleted temporary local file: ${tempFilePath}`);
    }
  }
}