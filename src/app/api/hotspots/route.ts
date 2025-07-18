
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

    const prompt = `
      You are an expert video editor. I will provide you with a timestamped transcript in JSON format. 
      Analyze this transcript and identify the most compelling and engaging moments that would make good video clips.
      Your response must be a JSON array of objects, where each object has the following properties: "startTime", "endTime", and "title".
      - "startTime" and "endTime" must be numbers, corresponding to the start and end times of the clip in seconds.
      - "title" must be a short, catchy title for the clip.
      - Base your suggestions on the provided start and end times in the transcript. Do not make up timestamps.

      Here is the transcript:
      ${JSON.stringify(transcript, null, 2)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract the JSON array from the response
    const jsonArray = JSON.parse(text.match(/(\[.*\])/s)![0]);

    return NextResponse.json(jsonArray);
  } catch (error) {
    console.error("Error generating hotspots:", error);
    return NextResponse.json({ error: "Failed to generate hotspots" }, { status: 500 });
  }
}
