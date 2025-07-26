"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, Video } from "lucide-react";
import { Selection, TranscriptWord, Transform } from "@/lib/types";

interface CaptionStyle {
  textColor: string;
  highlightColor: string;
  outlineColor: string;
  fontFamily: string;
  fontSize: number;
}

interface DirectYouTubeUploadProps {
  videoUrl: string;
  selection: Selection;
  transcript: TranscriptWord[];
  accessToken: string;
  generatedBackground?: string | null;
  captionStyle: CaptionStyle;
  transform: Transform;
  onUploadComplete?: (videoId: string) => void;
}

export default function DirectYouTubeUpload({
  videoUrl,
  selection,
  transcript,
  accessToken,
  generatedBackground,
  captionStyle,
  transform,
  onUploadComplete,
}: DirectYouTubeUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!videoUrl || !selection || !accessToken) return;

    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const startTime = selection.start;
      const endTime = selection.end;

      const clipTitle = `Clip: ${startTime.toFixed(1)}s - ${endTime.toFixed(
        1
      )}s`;
      const clipDescription = `Extracted clip from ${startTime.toFixed(
        1
      )}s to ${endTime.toFixed(1)}s

Transcript:
${transcript
  .filter((word) => word.start >= startTime && word.end <= endTime)
  .map((word) => word.punctuated_word)
  .join(" ")}`;

      setProgress(20);

      // Upload via our clip API endpoint (handles video rendering and YouTube upload server-side)
      const uploadResponse = await fetch("/api/youtube/clip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrl,
          selection,
          transcript,
          accessToken,
          title: clipTitle,
          description: clipDescription,
          // Include all rendering parameters
          generatedBackground,
          captionStyle,
          transform,
        }),
      });

      setProgress(90);

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || "Upload failed");
      }

      const result = await uploadResponse.json();
      setProgress(100);

      onUploadComplete?.(result.videoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  const getProgressMessage = () => {
    if (progress < 30) return "Rendering video with transformations...";
    if (progress < 90) return "Uploading to YouTube...";
    return "Finalizing...";
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isProcessing && (
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-muted-foreground">
            {getProgressMessage()}
          </p>
        </div>
      )}

      <Button
        onClick={handleUpload}
        disabled={isProcessing}
        className="w-full bg-red-500 hover:bg-red-600"
      >
        {isProcessing ? (
          "Processing & Uploading..."
        ) : (
          <>
            <Video className="h-4 w-4 mr-2" />
            Upload Clip to YouTube
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground">
        This will render and upload the selected clip (
        {selection.start.toFixed(1)}s - {selection.end.toFixed(1)}s) with all
        your edits (aspect ratio: {transform.aspectRatio}, captions, AI
        background) to YouTube.
      </p>
    </div>
  );
}
