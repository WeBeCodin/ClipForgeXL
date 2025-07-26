"use client";

import { useEffect } from "react";

export default function YouTubeCallback() {
  useEffect(() => {
    // Extract the access token from URL hash (YouTube OAuth flow)
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const error = params.get("error");

    if (error) {
      // Send error back to parent window
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "YOUTUBE_TOKEN_ERROR",
            error: error,
          },
          window.location.origin
        );
      }
      window.close();
      return;
    }

    if (accessToken) {
      // Send token back to parent window
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "YOUTUBE_TOKEN",
            token: accessToken,
          },
          window.location.origin
        );
      }
      window.close();
    } else {
      // No token found, show error
      console.error("No access token found in callback");
      if (window.opener) {
        window.opener.postMessage(
          {
            type: "YOUTUBE_TOKEN_ERROR",
            error: "No access token received",
          },
          window.location.origin
        );
      }
      window.close();
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground">Connecting to YouTube...</p>
        <p className="text-sm text-muted-foreground">
          This window will close automatically.
        </p>
      </div>
    </div>
  );
}
