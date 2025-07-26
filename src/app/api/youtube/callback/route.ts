import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  // Initialize OAuth2Client inside the function to ensure env vars are loaded
  const CLIENT_ID = process.env.NEXT_PUBLIC_YOUTUBE_CLIENT_ID!;
  const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET!;
  const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI!;

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return NextResponse.redirect(
      new URL(
        "/?youtube_error=" + encodeURIComponent("Missing OAuth configuration"),
        req.url
      )
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    // User denied access or other OAuth error
    return NextResponse.redirect(
      new URL("/?youtube_error=" + encodeURIComponent(error), req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/?youtube_error=" +
          encodeURIComponent("No authorization code received"),
        req.url
      )
    );
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    // Redirect back to the main app with the access token
    const redirectUrl = new URL("/", req.url);
    redirectUrl.searchParams.set("access_token", tokens.access_token!);

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("OAuth token exchange error:", error);
    return NextResponse.redirect(
      new URL(
        "/?youtube_error=" +
          encodeURIComponent("Failed to exchange authorization code"),
        req.url
      )
    );
  }
}
