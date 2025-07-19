import { NextRequest, NextResponse } from "next/server";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase"; // The app export is now correctly typed
import { z } from "zod";

// This schema is now used on the client-side before calling the API, 
// and also in the Cloud Function for validation.
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

    // The validation is important here to give immediate feedback 
    // before invoking the Cloud Function.
    const parseResult = renderRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request payload.", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    
    const renderData = parseResult.data;

    // Initialize Cloud Functions and get a reference to the function
    const functions = getFunctions(app, "us-central1"); // app is now correctly typed
    const renderVideo = httpsCallable(functions, 'renderVideo');

    // Call the Cloud Function with the validated data
    const result = await renderVideo(renderData);
    
    // The result from the Cloud Function will contain the data we returned,
    // in this case, a message and the video URL.
    const { data }: any = result;

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Error calling renderVideo Cloud Function:", error);
    
    // The error object from a callable function contains more details
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
