import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    // Try gemini-1.5-flash first (faster and less likely to be overloaded)
    let model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

    let result;
    try {
      result = await model.generateContent(prompt);
    } catch (error: any) {
      // If gemini-1.5-flash is overloaded, try gemini-1.5-pro
      if (error.status === 503) {
        console.log("Gemini Flash overloaded, trying Pro model...");
        model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        result = await model.generateContent(prompt);
      } else {
        throw error;
      }
    }

    const response = await result.response;
    const text = response.text();

    // Extract the JSON array from the response
    const jsonMatch = text.match(/(\[.*\])/s);
    if (!jsonMatch) {
      throw new Error("No valid JSON array found in response");
    }

    const jsonArray = JSON.parse(jsonMatch[0]);

    return NextResponse.json(jsonArray);
  } catch (error: any) {
    console.error("Error generating hotspots:", error);

    if (error.status === 503) {
      return NextResponse.json(
        {
          error:
            "AI service is temporarily overloaded. Please try again in a few moments.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to generate hotspots",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
