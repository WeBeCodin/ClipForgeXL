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
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-pro-latest",
    generationConfig: {
      maxOutputTokens: 32768, // Increase token limit for complete transcription
      temperature: 0.1, // Lower temperature for more consistent results
    }
  });

  const videoPart = await fileToGenerativePart(bucketName, filePath);

  const prompt = `
Transcribe this ENTIRE video completely and provide the output in JSON format with word-level timestamps. 

IMPORTANT: 
- Transcribe ALL spoken words from start to finish of the video
- Do not truncate or summarize - include every single word
- Provide accurate timestamps for each word
- Include all pauses, repetitions, and filler words

The JSON should be an object with a single key 'words', which is an array of objects. Each object should have:
- 'word': the raw word without punctuation
- 'start': start time in seconds (decimal)
- 'end': end time in seconds (decimal)  
- 'punctuated_word': the word with proper punctuation and capitalization

Ensure the transcription is COMPLETE from beginning to end of the video.`;

  const result = await model.generateContent([prompt, videoPart]);
  const response = result.response;
  const text = response.text().replace(/```json|```/g, "").trim();

  try {
    const transcription = JSON.parse(text);
    
    // Validate that we have a complete transcription
    if (!transcription.words || transcription.words.length === 0) {
      throw new Error("Empty transcription received");
    }
    
    console.log(`Transcription completed: ${transcription.words.length} words processed`);
    return transcription;
  } catch (error) {
    console.error("Failed to parse transcription JSON:", error);
    console.error("Raw response:", text);
    throw new Error("Invalid transcription format received");
  }
}