"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Youtube, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

interface YouTubeConnectionProps {
  onConnectionChange?: (connected: boolean, accessToken?: string) => void;
}

export default function YouTubeConnection({
  onConnectionChange,
}: YouTubeConnectionProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channelInfo, setChannelInfo] = useState<{
    name: string;
    id: string;
  } | null>(null);

  useEffect(() => {
    // Check if already connected (from localStorage or session)
    const storedToken = localStorage.getItem("youtube_access_token");
    const storedChannelInfo = localStorage.getItem("youtube_channel_info");

    if (storedToken && storedChannelInfo) {
      setAccessToken(storedToken);
      setChannelInfo(JSON.parse(storedChannelInfo));
      setIsConnected(true);
      onConnectionChange?.(true, storedToken);
    }
  }, [onConnectionChange]);

  const connectToYouTube = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Get OAuth URL from our API
      const response = await fetch("/api/youtube");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get OAuth URL");
      }

      // Redirect to OAuth
      window.location.href = data.authUrl;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect to YouTube"
      );
      setIsConnecting(false);
    }
  };

  const disconnectFromYouTube = () => {
    localStorage.removeItem("youtube_access_token");
    localStorage.removeItem("youtube_channel_info");
    setAccessToken(null);
    setChannelInfo(null);
    setIsConnected(false);
    onConnectionChange?.(false);
  };

  const fetchChannelInfo = async (token: string) => {
    try {
      const response = await fetch("/api/youtube/channel", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const channelData = await response.json();
        setChannelInfo(channelData);
        localStorage.setItem(
          "youtube_channel_info",
          JSON.stringify(channelData)
        );
      }
    } catch (err) {
      console.error("Failed to fetch channel info:", err);
    }
  };

  // Handle OAuth callback (this would typically be handled by the callback route)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get("access_token");

    if (accessToken) {
      setAccessToken(accessToken);
      setIsConnected(true);
      localStorage.setItem("youtube_access_token", accessToken);
      onConnectionChange?.(true, accessToken);

      // Fetch channel info
      fetchChannelInfo(accessToken);

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsConnecting(false);
    }
  }, [onConnectionChange]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-red-500" />
          YouTube Channel Connection
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Status:</span>
            {isConnected ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Connected
              </Badge>
            )}
          </div>

          {isConnected ? (
            <Button variant="outline" size="sm" onClick={disconnectFromYouTube}>
              Disconnect
            </Button>
          ) : (
            <Button
              onClick={connectToYouTube}
              disabled={isConnecting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isConnecting ? (
                "Connecting..."
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect YouTube
                </>
              )}
            </Button>
          )}
        </div>

        {channelInfo && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              Connected to:{" "}
              <span className="font-medium">{channelInfo.name}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Channel ID: {channelInfo.id}
            </p>
          </div>
        )}

        {!isConnected && (
          <p className="text-xs text-muted-foreground">
            Connect your YouTube channel to upload videos directly from
            ClipForge XL.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
