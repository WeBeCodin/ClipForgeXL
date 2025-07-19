import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

    const fullPrompt = `Based on the following description, create a concise and descriptive title for a background image: "${prompt}"`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text().replace(/
/g, "");

    // Using the generated text to create a placeholder image URL
    return NextResponse.json({ backgroundUrl: `https://dummyimage.com/1080x1920/000/fff&text=${encodeURIComponent(text)}` });
    
  } catch (error) {
    console.error("Error generating background:", error);
    return NextResponse.json({ error: "Failed to generate background" }, { status: 500 });
  }
}
