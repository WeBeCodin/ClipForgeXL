import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import fetch from "node-fetch";

const youtube = google.youtube({
  version: "v3",
  auth: new google.auth.OAuth2(
    process.env.NEXT_PUBLIC_YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    `${process.env.VERCEL_URL || "http://localhost:9003"}/youtube-callback`
  ),
});

export async function POST(request: NextRequest) {
  try {
    const { clipUrl, title, description, tags, accessToken } =
      await request.json();

    if (!clipUrl || !accessToken) {
      return NextResponse.json(
        { error: "Missing required parameters: clipUrl and accessToken" },
        { status: 400 }
      );
    }

    // Set the access token for the YouTube API
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({ access_token: accessToken });

    const youtubeAuth = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    // Download the video file from the clip URL
    const videoResponse = await fetch(clipUrl);
    if (!videoResponse.ok) {
      throw new Error("Failed to download video from clip URL");
    }

    const videoBuffer = await videoResponse.buffer();

    // Upload to YouTube
    const uploadResponse = await youtubeAuth.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: title || "AI Generated Clip",
          description: description || "Generated with ClipForge XL",
          tags: tags || ["AI", "clips", "ClipForge"],
          categoryId: "24", // Entertainment category
        },
        status: {
          privacyStatus: "unlisted", // Upload as unlisted for review
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: videoBuffer,
      },
    });

    const videoId = uploadResponse.data.id;
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

    return NextResponse.json({
      success: true,
      videoId,
      youtubeUrl,
      message: "Video uploaded successfully to YouTube",
    });
  } catch (error: any) {
    console.error("YouTube upload error:", error);

    // Handle specific YouTube API errors
    if (error.code === 401) {
      return NextResponse.json(
        {
          error:
            "YouTube authentication failed. Please reconnect your YouTube account.",
        },
        { status: 401 }
      );
    }

    if (error.code === 403) {
      return NextResponse.json(
        { error: "YouTube API quota exceeded or permissions denied." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to upload to YouTube" },
      { status: 500 }
    );
  }
}
