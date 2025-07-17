// This is a temporary file to demonstrate the core AI logic.
// In a real application, this would be part of a Cloud Function.

import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

// IMPORTANT: The 'gemini-1.5-flash' model is recommended for its balance of speed and accuracy in transcription.
const model = "gemini-1.5-flash";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Transcribes a video file from a Google Cloud Storage URI.
 * @param gcsUri The GCS URI of the video file (e.g., "gs://bucket-name/path/to/video.mp4").
 * @returns The generated transcript as a string.
 */
export async function transcribeVideo(gcsUri: string): Promise<string> {
  console.log(`Starting transcription for ${gcsUri} with model ${model}...`);

  try {
    const generativeModel = genAI.getGenerativeModel({
      model: model,
      // The system instruction helps ensure the AI focuses on the transcription task.
      systemInstruction: "You are an expert transcriber. Transcribe the given video with high accuracy.",
    });

    const prompt = "Please transcribe this video.";
    const file = {
      fileData: {
        mimeType: "video/mp4", // Assuming MP4, this might need to be dynamic in a real implementation.
        fileUri: gcsUri,
      },
    };

    const result = await generativeModel.generateContent([prompt, file]);
    const response = result.response;
    const text = response.text();
    
    console.log("Transcription successful.");
    return text;
  } catch (error) {
    console.error("Error during transcription:", error);
    throw new Error("Failed to transcribe video.");
  }
}
