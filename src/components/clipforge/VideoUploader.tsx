"use client";

import { ChangeEvent, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, Loader2, FileText, Video } from "lucide-react";

type VideoUploaderProps = {
  onFileSelect: (video: File, transcript?: File) => void;
  onDemoVideoSelect: () => void;
  status: "idle" | "authenticating" | "uploading" | "processing" | "ready" | "error";
  progress: number;
};

export function VideoUploader({ onFileSelect, onDemoVideoSelect, status, progress }: VideoUploaderProps) {
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [selectedTranscript, setSelectedTranscript] = useState<File | null>(null);

  const handleVideoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedVideo(file);
    }
  };

  const handleTranscriptChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedTranscript(file);
    }
  };

  const handleUpload = () => {
    if (selectedVideo) {
      onFileSelect(selectedVideo, selectedTranscript || undefined);
      setSelectedVideo(null);
      setSelectedTranscript(null);
    }
  };

  const statusMessages = {
    authenticating: "Authenticating...",
    uploading: "Uploading files...",
    processing: selectedTranscript ? "Processing video with transcript..." : "Processing and transcribing...",
    error: "An error occurred. Please refresh and try again.",
    idle: "",
    ready: "",
  };
  
  const isInteractive = status === 'idle' || status === 'ready';

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg text-center shadow-2xl">
        <CardHeader>
          <div className="mx-auto bg-accent/10 p-4 rounded-full mb-4">
             {status === 'authenticating' || status === 'uploading' || status === 'processing' ? (
                <Loader2 className="w-10 h-10 text-accent animate-spin" />
             ) : (
                <UploadCloud className="w-10 h-10 text-accent" />
             )}
          </div>
          <CardTitle className="font-headline text-3xl">Upload Your Content</CardTitle>
          <CardDescription>
            Upload your video and optionally a transcript file for faster, more accurate processing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isInteractive ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">{statusMessages[status]}</p>
              {status === 'uploading' && <Progress value={progress} className="w-full" />}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Video Upload */}
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Video className="w-5 h-5" />
                  <span className="font-medium">Video File (Required)</span>
                </div>
                {selectedVideo ? (
                  <div className="text-sm text-muted-foreground">
                    Selected: {selectedVideo.name}
                  </div>
                ) : (
                  <Button variant="outline" asChild>
                    <label htmlFor="video-upload" className="cursor-pointer">
                      Select Video
                    </label>
                  </Button>
                )}
                <input 
                  id="video-upload" 
                  type="file" 
                  accept="video/*" 
                  className="hidden" 
                  onChange={handleVideoChange} 
                />
              </div>

              {/* Transcript Upload */}
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5" />
                  <span className="font-medium">Transcript (Optional)</span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Upload SRT, VTT, or JSON transcript for faster processing
                </p>
                {selectedTranscript ? (
                  <div className="text-sm text-muted-foreground">
                    Selected: {selectedTranscript.name}
                  </div>
                ) : (
                  <Button variant="outline" size="sm" asChild>
                    <label htmlFor="transcript-upload" className="cursor-pointer">
                      Select Transcript
                    </label>
                  </Button>
                )}
                <input 
                  id="transcript-upload" 
                  type="file" 
                  accept=".srt,.vtt,.json,.txt" 
                  className="hidden" 
                  onChange={handleTranscriptChange} 
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button 
                  size="lg" 
                  onClick={handleUpload} 
                  disabled={!selectedVideo}
                  className="min-w-[120px]"
                >
                  Upload {selectedTranscript ? "& Process" : "& Transcribe"}
                </Button>
                <Button size="lg" variant="secondary" onClick={onDemoVideoSelect}>
                  Use Demo Video
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}