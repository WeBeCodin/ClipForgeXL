import { NextRequest, NextResponse } from "next/server";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase"; 
import { z } from "zod";

const renderRequestSchema = z.object({
  videoUrl: z.string().url(),
  transcript: z.array(z.object({
    word: z.string(),
    start: z.number(),
    end: z.number(),
    punctuated_word: z.string(),
  })),
  selection: z.object({ start: z.number(), end: z.number() }),
  generatedBackground: z.string().url().optional().nullable(),
  captionStyle: z.object({
    textColor: z.string(),
    highlightColor: z.string(),
    outlineColor: z.string(),
    fontFamily: z.string(),
    fontSize: z.number(),
  }),
  transform: z.object({
    pan: z.object({ x: z.number(), y: z.number() }),
    zoom: z.number(),
    aspectRatio: z.string(),
  }),
});


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parseResult = renderRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request payload.", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    
    const renderData = parseResult.data;

    // Explicitly set the region to 'us-central1'
    const functions = getFunctions(app, "us-central1"); 
    const renderVideo = httpsCallable(functions, 'renderVideo');

    const result = await renderVideo(renderData);
    
    const { data }: any = result;

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Error calling renderVideo Cloud Function:", error);
    
    const code = error.code || 'unknown';
    const message = error.message || 'An unknown error occurred.';
    const details = error.details || {};

    return NextResponse.json(
      { 
        error: `Failed to start the render process: ${message}`,
        details: { code, details }
      }, 
      { status: 500 }
    );
  }
}
