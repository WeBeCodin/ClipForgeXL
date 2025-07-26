import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  // Initialize OAuth2Client inside the function to ensure env vars are loaded
  const CLIENT_ID = process.env.NEXT_PUBLIC_YOUTUBE_CLIENT_ID!;
  const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET!;
  const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI!;

  // Debug logging
  console.log("YouTube OAuth Config:", {
    CLIENT_ID: CLIENT_ID ? "Set" : "Missing",
    CLIENT_SECRET: CLIENT_SECRET ? "Set" : "Missing",
    REDIRECT_URI: REDIRECT_URI ? "Set" : "Missing",
    CLIENT_ID_PARTIAL: CLIENT_ID?.substring(0, 10) + "...",
  });

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return NextResponse.json(
      { error: "Missing OAuth configuration" },
      { status: 500 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  // Generate OAuth URL for YouTube authentication
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    prompt: "consent",
  });

  return NextResponse.json({ authUrl: url });
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "No access token provided" },
      { status: 401 }
    );
  }

  const accessToken = authHeader.replace("Bearer ", "");

  try {
    const formData = await req.formData();
    const videoFile = formData.get("video") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const tags = formData.get("tags") as string;
    const privacy = formData.get("privacy") as string;
    const category = formData.get("category") as string;

    if (!videoFile) {
      return NextResponse.json(
        { error: "No video file provided" },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: "Video title is required" },
        { status: 400 }
      );
    }

    // Initialize OAuth2Client for upload
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    // Convert File to Buffer
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());

    // Prepare video metadata
    const videoMetadata = {
      snippet: {
        title,
        description,
        tags: tags
          ? tags
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0)
          : [],
        categoryId: category,
      },
      status: {
        privacyStatus: privacy,
      },
    };

    // Upload video
    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: videoMetadata,
      media: {
        body: videoBuffer,
      },
    });

    return NextResponse.json({
      videoId: response.data.id,
      title: response.data.snippet?.title,
      url: `https://www.youtube.com/watch?v=${response.data.id}`,
    });
  } catch (error) {
    console.error("YouTube upload error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}
