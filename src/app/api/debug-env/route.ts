import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    CLIENT_ID: process.env.NEXT_PUBLIC_YOUTUBE_CLIENT_ID ? "Set" : "Missing",
    CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET ? "Set" : "Missing",
    REDIRECT_URI: process.env.YOUTUBE_REDIRECT_URI ? "Set" : "Missing",
    // For debugging - show partial values (but not full secrets)
    CLIENT_ID_PARTIAL:
      process.env.NEXT_PUBLIC_YOUTUBE_CLIENT_ID?.substring(0, 10) + "...",
    REDIRECT_URI_VALUE: process.env.YOUTUBE_REDIRECT_URI,
  });
}
