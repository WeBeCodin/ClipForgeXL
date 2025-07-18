
// functions/src/ai/transcribe-video.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {Storage} from "@google-cloud/storage";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Initialize the new GoogleGenerativeAI class with the API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const storage = new Storage();

function fileToGenerativePart(path: string, mimeType: string) {
    return {
      inlineData: {
        data: Buffer.from(fs.readFileSync(path)).toString("base64"),
        mimeType
      },
    };
  }

/**
 * Downloads a video from GCS, generates a transcription with word-level timestamps, and cleans up all resources.
 * @param bucketName The name of the Google Cloud Storage bucket.
 * @param filePath The path to the video file within the bucket.
 * @returns A promise that resolves to the structured transcription data.
 */
export async function transcribeVideo(bucketName: string, filePath: string): Promise<any> {
  const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));
  
  try {
    // Step 1: Download the file from GCS to a temporary local directory
    await storage.bucket(bucketName).file(filePath).download({ destination: tempFilePath });
    console.log(`Successfully downloaded file from GCS to temporary path: ${tempFilePath}.`);

    const videoFilePart = fileToGenerativePart(tempFilePath, "video/mp4");

    // Step 2: Generate content using the video data
    const prompt = `
      Please provide a detailed, verbatim transcription of the audio in this video file.
      The output should be a JSON object containing a single key "words", which is an array of objects.
      Each object in the "words" array should have the following properties:
      - "word": The transcribed word.
      - "punctuated_word": The transcribed word with punctuation.
      - "start": The start time of the word in seconds.
      - "end": The end time of the word in seconds.
    `;
    
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-pro-latest",
        generationConfig: {
          responseMimeType: "application/json",
        },
    });

    const result = await model.generateContent([prompt, videoFilePart]);

    const candidate = result.response.candidates?.[0];

    if (!candidate || !candidate.content || !candidate.content.parts) {
      throw new Error("Transcription failed: No candidates returned by the model.");
    }
    const transcriptionText = candidate.content.parts.map(part => part.text).join("");
    
    // The response is now guaranteed to be a JSON string.
    const transcription = JSON.parse(transcriptionText);
    
    console.log("Transcription generation completed successfully.");
 
    if (!transcription || !transcription.words) {
      throw new Error("Transcription failed: No words were returned by the model.");
    }

    return transcription;

 } catch (error) {
    console.error("An error occurred in the transcribeVideo workflow:", error);
    throw new Error(`Failed to transcribe video: ${error instanceof Error? error.message : String(error)}`);
  } finally {
    // Clean up the temporary local file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`Successfully deleted temporary local file: ${tempFilePath}`);
    }
  }
}
