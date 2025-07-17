
"use client";

import { ChangeEvent } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, Loader2 } from "lucide-react";

type VideoUploaderProps = {
  onFileSelect: (file: File) => void;
  onDemoVideoSelect: () => void;
  status: "idle" | "authenticating" | "uploading" | "processing" | "error";
  progress: number;
};

export function VideoUploader({ onFileSelect, onDemoVideoSelect, status, progress }: VideoUploaderProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const statusMessages = {
    authenticating: "Authenticating...",
    uploading: "Uploading video...",
    processing: "Processing and transcribing...",
    error: "An error occurred. Please refresh and try again.",
    idle: "",
  };
  
  const isInteractive = status === 'idle';

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
          <CardTitle className="font-headline text-3xl">Upload Your Video</CardTitle>
          <CardDescription>Drag and drop or select a video file to start creating clips.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isInteractive ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">{statusMessages[status]}</p>
              {status === 'uploading' && <Progress value={progress} className="w-full" />}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button size="lg" asChild>
                <label htmlFor="video-upload" className="cursor-pointer">
                  Select File
                </label>
              </Button>
              <input id="video-upload" type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
              <Button size="lg" variant="secondary" onClick={onDemoVideoSelect}>
                Use Demo Video
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
