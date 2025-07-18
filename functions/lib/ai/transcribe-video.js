"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeVideo = transcribeVideo;
// functions/src/ai/transcribe-video.ts
const genai_1 = require("@google/genai");
const fs = require("fs");
const os = require("os");
const path = require("path");
const storage_1 = require("@google-cloud/storage");
const dotenv = require("dotenv");
// Load environment variables from .env file
dotenv.config();
// Initialize the new GoogleGenAI class with the API key
const genAI = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const storage = new storage_1.Storage();
const POLLING_INTERVAL_MS = 10000; // 10 seconds
const MAX_POLLING_ATTEMPTS = 60; // 10 minutes max
/**
 * Downloads a video from GCS, uploads it to the Gemini File API,
 * generates a transcription, and cleans up all resources.
 * @param bucketName The name of the Google Cloud Storage bucket.
 * @param filePath The path to the video file within the bucket.
 * @returns A promise that resolves to the transcribed text.
 */
async function transcribeVideo(bucketName, filePath) {
    var _a;
    const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));
    let fileUploadResponse;
    try {
        // Step 1: Download the file from GCS to a temporary local directory
        await storage.bucket(bucketName).file(filePath).download({ destination: tempFilePath });
        console.log(`Successfully downloaded file from GCS to temporary path: ${tempFilePath}.`);
        // Step 2: Upload the local file to the Gemini File API
        console.log(`Uploading ${tempFilePath} to the Gemini File API...`);
        fileUploadResponse = await genAI.files.upload({
            file: tempFilePath,
        });
        console.log(`Upload complete. File API Name: ${fileUploadResponse.name}, URI: ${fileUploadResponse.uri}`);
        // Step 2.5: Poll for ACTIVE state
        console.log(`Polling for file to become active. This may take a few minutes...`);
        let attempts = 0;
        let geminiFile;
        if (!(fileUploadResponse === null || fileUploadResponse === void 0 ? void 0 : fileUploadResponse.name)) {
            throw new Error("File upload failed, no name returned.");
        }
        while (attempts < MAX_POLLING_ATTEMPTS) {
            const file = await genAI.files.get({ name: fileUploadResponse.name });
            if (file.state === genai_1.FileState.ACTIVE) {
                console.log(`File is now ACTIVE.`);
                geminiFile = file;
                break;
            }
            else if (file.state === genai_1.FileState.FAILED) {
                throw new Error(`File processing failed with state: ${file.state}`);
            }
            console.log(`Current file state: ${file.state}. Waiting ${POLLING_INTERVAL_MS / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
            attempts++;
        }
        if (!geminiFile || geminiFile.state !== genai_1.FileState.ACTIVE) {
            throw new Error(`File did not become active after ${attempts * POLLING_INTERVAL_MS / 1000} seconds. Last state: ${geminiFile === null || geminiFile === void 0 ? void 0 : geminiFile.state}`);
        }
        // Step 3: Generate content using the File API URI
        const prompt = "Please provide a detailed, verbatim transcription of the audio in this video file.";
        // Correctly call generateContent on the 'models' submodule
        const result = await genAI.models.generateContent({
            model: "gemini-1.5-pro-latest",
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        {
                            fileData: {
                                mimeType: geminiFile.mimeType,
                                fileUri: geminiFile.uri,
                            },
                        },
                    ],
                },
            ],
        });
        const candidate = (_a = result.candidates) === null || _a === void 0 ? void 0 : _a[0];
        if (!candidate || !candidate.content || !candidate.content.parts) {
            throw new Error("Transcription failed: No candidates returned by the model.");
        }
        const transcription = candidate.content.parts.map(part => part.text).join("");
        console.log("Transcription generation completed successfully.");
        if (transcription === undefined) {
            throw new Error("Transcription failed: No text was returned by the model.");
        }
        return transcription;
    }
    catch (error) {
        console.error("An error occurred in the transcribeVideo workflow:", error);
        throw new Error(`Failed to transcribe video: ${error instanceof Error ? error.message : String(error)}`);
    }
    finally {
        // Step 4: Clean up resources regardless of success or failure
        // Clean up the file from the Gemini File API
        if (fileUploadResponse && fileUploadResponse.name) {
            try {
                await genAI.files.delete({ name: fileUploadResponse.name });
                console.log(`Successfully cleaned up file from File API: ${fileUploadResponse.name}`);
            }
            catch (cleanupError) {
                console.error(`Failed to clean up file from File API (${fileUploadResponse.name}):`, cleanupError);
            }
        }
        // Clean up the temporary local file
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            console.log(`Successfully deleted temporary local file: ${tempFilePath}`);
        }
    }
}
//# sourceMappingURL=transcribe-video.js.map