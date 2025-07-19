import { GoogleGenerativeAI } from "@google/generative-ai";
import { Storage } from "@google-cloud/storage";

const storage = new Storage();

interface Transcription {
  words: {
    word: string;
    start: number;
    end: number;
    punctuated_word: string;
  }[];
}

async function fileToGenerativePart(bucketName: string, filePath: string) {
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

export async function transcribeVideo(
  bucketName: string,
  filePath: string
): Promise<Transcription> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

  const videoPart = await fileToGenerativePart(bucketName, filePath);

  const prompt =
    "Transcribe this video and provide the output in JSON format with word-level timestamps. The JSON should be an object with a single key, 'words', which is an array of objects. Each object should have 'word', 'start', 'end', and 'punctuated_word' keys.";

  const result = await model.generateContent([prompt, videoPart]);
  const response = result.response;
  const text = response.text().replace(/```json|```/g, "").trim();

  return JSON.parse(text);
}