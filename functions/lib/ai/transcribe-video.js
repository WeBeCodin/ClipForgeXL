"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeVideo = transcribeVideo;
const _google_generative_ai_1 = require("@google-generative-ai");
const storage_1 = require("@google-cloud/storage");
const storage = new storage_1.Storage();
// Converts a file from Google Cloud Storage into a Base64-encoded string
async function fileToGenerativePart(bucketName, filePath) {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);
    const [metadata] = await file.getMetadata();
    const mimeType = metadata.contentType;
    if (!mimeType) {
        throw new Error(`Could not determine MIME type for file: ${filePath}`);
    }
    const [buffer] = await file.download();
    return {
        inlineData: {
            data: buffer.toString("base64"),
            mimeType,
        },
    };
}
// Add an explicit return type to the function
async function transcribeVideo(bucketName, filePath) {
    const genAI = new _google_generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
    const videoPart = await fileToGenerativePart(bucketName, filePath);
    const prompt = "Transcribe this video and provide the output in JSON format with word-level timestamps. The JSON should be an object with a single key, 'words', which is an array of objects. Each object should have 'word', 'start', 'end', and 'punctuated_word' keys.";
    const result = await model.generateContent([prompt, videoPart]);
    const response = result.response;
    const text = response.text().replace(/```json
        | `` `/g, "").trim();
  
  return JSON.parse(text);
}
    );
}
//# sourceMappingURL=transcribe-video.js.map