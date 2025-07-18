
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

    const prompt = `
      You are an expert video editor. Analyze the following transcript and identify the most compelling and engaging moments that would make good video clips. 
      For each suggested clip, provide a start time and end time in seconds, and a short, catchy title.
      Return the results as a JSON array of objects, where each object has the following properties: "start", "end", and "title".
      Transcript:
      ${transcript}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract the JSON array from the response
    const jsonArray = JSON.parse(text.match(/(\[.*\])/s)![0]);

    // Map the response to the expected format
    const hotspots = jsonArray.map((hotspot: any) => ({
      startTime: Number(hotspot.start),
      endTime: Number(hotspot.end),
      title: hotspot.title,
    }));

    return NextResponse.json(hotspots);
  } catch (error) {
    console.error("Error generating hotspots:", error);
    return NextResponse.json({ error: "Failed to generate hotspots" }, { status: 500 });
  }
}
