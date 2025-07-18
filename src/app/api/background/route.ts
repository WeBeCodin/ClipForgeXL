import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // For now, we'll just return the generated text. In a real application, 
    // you would use a text-to-image model to generate an image from this text.
    return NextResponse.json({ backgroundUrl: `https://dummyimage.com/600x400/000/fff&text=${encodeURIComponent(text)}` });
  } catch (error) {
    console.error("Error generating background:", error);
    return NextResponse.json({ error: "Failed to generate background" }, { status: 500 });
  }
}
