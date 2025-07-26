import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "stream";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

export async function POST(req: NextRequest) {
  try {
    const {
      videoUrl,
      selection,
      transcript,
      accessToken,
      title,
      description,
      generatedBackground,
      captionStyle,
      transform,
    } = await req.json();

    // Validate required parameters
    if (!accessToken) {
      throw new Error("YouTube access token is required");
    }

    if (!videoUrl || !selection || !transcript) {
      throw new Error("Missing required video data");
    }

    console.log("YouTube upload request received:", {
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length,
      videoUrl: videoUrl?.substring(0, 50) + "...",
      selectionRange: `${selection.start}s - ${selection.end}s`,
    });

    // Step 1: For now, upload the original video directly (bypassing render function due to permissions)
    // TODO: Once Firebase Function is deployed with storage fix, switch back to rendering
    console.log(
      "Uploading original video directly (render function bypass)..."
    );

    // Fetch the original video directly
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
    }

    const videoBuffer = await videoResponse.arrayBuffer();
    const buffer = Buffer.from(videoBuffer);

    // Create a readable stream from the buffer
    const videoStream = new Readable({
      read() {
        this.push(buffer);
        this.push(null); // End the stream
      },
    });

    console.log("Video fetched, uploading to YouTube...");

    // Step 3: Prepare video metadata
    const clipDescription =
      description ||
      `Clip from ${selection.start.toFixed(1)}s to ${selection.end.toFixed(1)}s

Transcript:
${transcript
  .filter(
    (word: any) => word.start >= selection.start && word.end <= selection.end
  )
  .map((word: any) => word.punctuated_word)
  .join(" ")}`;

    // Step 4: Initialize OAuth2Client for upload
    console.log("Setting up YouTube API authentication...");

    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      // Add token type for better compatibility
      token_type: "Bearer",
    });

    console.log("OAuth2 client configured, creating YouTube API client...");

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    console.log("YouTube API client ready");

    // Test the authentication by making a simple API call first
    try {
      console.log("Testing YouTube API authentication...");
      const channelResponse = await youtube.channels.list({
        part: ["snippet"],
        mine: true,
      });
      console.log(
        "Authentication test successful, channel:",
        channelResponse.data.items?.[0]?.snippet?.title
      );
    } catch (authError: any) {
      console.error("YouTube authentication test failed:", authError.message);

      // Check if it's an authentication error
      if (
        authError.message?.includes("invalid_token") ||
        authError.message?.includes("Invalid Credentials") ||
        authError.message?.includes("authentication") ||
        authError.message?.includes("OAuth")
      ) {
        throw new Error(
          "YouTube access token has expired. Please disconnect and reconnect your YouTube account."
        );
      }

      throw new Error(`YouTube authentication failed: ${authError.message}`);
    }

    // Determine video category and privacy based on aspect ratio
    const isVertical = transform.aspectRatio === "9/16";

    const videoMetadata = {
      snippet: {
        title:
          title ||
          `Clip: ${selection.start.toFixed(1)}s - ${selection.end.toFixed(1)}s`,
        description: clipDescription,
        tags: ["clip", "extract", "video", ...(isVertical ? ["shorts"] : [])],
        categoryId: "22", // People & Blogs
      },
      status: {
        privacyStatus: "unlisted",
      },
    };

    // Step 5: Upload video to YouTube
    console.log("Uploading to YouTube...");
    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: videoMetadata,
      media: {
        body: videoStream,
      },
    });

    console.log("YouTube upload completed successfully");

    return NextResponse.json({
      videoId: response.data.id,
      title: response.data.snippet?.title,
      url: `https://www.youtube.com/watch?v=${response.data.id}`,
      isShort: isVertical,
    });
  } catch (error: any) {
    console.error("Clip upload error:", error);

    // Provide more specific error messages
    let errorMessage = "Failed to upload clip";
    let statusCode = 500;

    if (error?.message?.includes("storage.objects.get")) {
      errorMessage =
        "Storage permission error: The service account needs storage.objects.get permission. Please check Firebase Storage permissions.";
      statusCode = 403;
    } else if (
      error?.message?.includes("expired") ||
      error?.message?.includes("authentication") ||
      error?.message?.includes("OAuth")
    ) {
      errorMessage =
        error.message ||
        "YouTube authentication failed. Please reconnect your YouTube account.";
      statusCode = 401;
    } else if (error?.message?.includes("renderVideo")) {
      errorMessage = `Video rendering failed: ${error.message}`;
      statusCode = 422;
    } else if (error?.message?.includes("YouTube")) {
      errorMessage = `YouTube upload failed: ${error.message}`;
      statusCode = 502;
    } else if (error?.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error.details || {},
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }
}
