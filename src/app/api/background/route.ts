import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not configured.");
    return NextResponse.json(
      {
        error: "Server configuration error: The GEMINI_API_KEY is missing.",
        details: "Please make sure the GEMINI_API_KEY environment variable is set on the server."
      },
      { status: 500 }
    );
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "A prompt is required to generate an image." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

    // A smarter prompt that instructs the AI to use a public image generation service.
    // This is a more reliable way to get an image URL from a text-based model.
    const fullPrompt = `Your task is to create a URL that will generate a photorealistic, 1920x1080 background image for a podcast.
The theme for the image is: "${prompt}".

To do this, create a detailed, descriptive paragraph for an AI image generator based on the theme. Then, URL-encode this description.
Finally, construct a URL using the following format: \`https://image.pollinations.ai/prompt/\${encoded_description}\`

Return ONLY the final, complete URL and nothing else.`;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const text = response.text().trim();

    // The model should now return a valid URL.
    if (!text.startsWith("http")) {
      console.error("AI did not return a valid URL. Response:", text);
      return NextResponse.json(
        {
          error: "The AI model did not return a valid image URL.",
          details: `The model responded with the following text: "${text}"`
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ backgroundUrl: text });

  } catch (error: any) {
    console.error("Error generating background:", error);

    let errorMessage = "An unknown error occurred while generating the background.";
    if (error.message?.includes("API key not valid")) {
        errorMessage = "The provided GEMINI_API_KEY is not valid. Please check your credentials.";
    } else if (error.message?.includes("Billing")) {
        errorMessage = "Billing is not enabled for the associated Google Cloud project.";
    } else if (error.message?.includes("quota")) {
      errorMessage = "You have exceeded your API quota. Please check your usage limits.";
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error.message
      },
      { status: 500 }
    );
  }
}
