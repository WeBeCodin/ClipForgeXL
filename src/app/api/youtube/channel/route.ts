import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "No access token provided" },
      { status: 401 }
    );
  }

  const accessToken = authHeader.replace("Bearer ", "");

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    const response = await youtube.channels.list({
      part: ["snippet"],
      mine: true,
    });

    if (!response.data.items || response.data.items.length === 0) {
      return NextResponse.json({ error: "No channel found" }, { status: 404 });
    }

    const channel = response.data.items[0];

    return NextResponse.json({
      id: channel.id,
      name: channel.snippet?.title,
      description: channel.snippet?.description,
      thumbnailUrl: channel.snippet?.thumbnails?.default?.url,
    });
  } catch (error) {
    console.error("YouTube API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel info" },
      { status: 500 }
    );
  }
}
