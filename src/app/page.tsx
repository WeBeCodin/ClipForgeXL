
"use client";

import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/clipforge/Header";
import { VideoUploader } from "@/components/clipforge/VideoUploader";
import { Editor } from "@/components/clipforge/Editor";
import { Hotspot, Selection, TranscriptWord } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";


const DEMO_VIDEO_URL = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

// Mock data until real transcription is implemented
const MOCK_TRANSCRIPT: TranscriptWord[] = [
  { start: 0.5, end: 0.9, word: "So", punctuated_word: "So," },
  { start: 0.9, end: 1.2, word: "what", punctuated_word: "what" },
  { start: 1.2, end: 1.4, word: "we're", punctuated_word: "we're" },
  { start: 1.4, end: 1.7, word: "going", punctuated_word: "going" },
  { start: 1.7, end: 1.9, word: "to", punctuated_word: "to" },
  { start: 1.9, end: 2.2, word: "do", punctuated_word: "do" },
  { start: 2.2, end: 2.4, word: "is", punctuated_word: "is," },
  { start: 2.4, end: 2.8, word: "we're", punctuated_word: "we're" },
  { start: 2.8, end: 3.1, word: "going", punctuated_word: "going" },
  { start: 3.1, end: 3.3, word: "to", punctuated_word: "to" },
  { start: 3.3, end: 3.7, word: "build", punctuated_word: "build" },
  { start: 3.7, end: 3.8, word: "an", punctuated_word: "an" },
  { start: 3.8, end: 4.3, word: "application", punctuated_word: "application" },
];

type AppState = "idle" | "uploading" | "processing" | "ready";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptWord[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  
  const handleFileSelect = (file: File) => {
    setAppState("uploading");
    const url = URL.createObjectURL(file);
    
    // Simulate upload and processing
    let currentProgress = 0;
    const uploadInterval = setInterval(() => {
      currentProgress += 10;
      setProgress(currentProgress);
      if (currentProgress >= 100) {
        clearInterval(uploadInterval);
        setAppState("processing");
        const processInterval = setInterval(() => {
          currentProgress += 10;
          setProgress(currentProgress % 100);
           if (currentProgress >= 200) {
            clearInterval(processInterval);
            setVideoUrl(url);
            setTranscript(MOCK_TRANSCRIPT);
            setAppState("ready");
           }
        }, 150)
      }
    }, 100);
  };
  
  const handleDemoVideoSelect = () => {
     setAppState("processing");
     setProgress(50);
     setTimeout(() => {
       setVideoUrl(DEMO_VIDEO_URL);
       setTranscript(MOCK_TRANSCRIPT);
       setAppState("ready");
       setProgress(100);
     }, 1000)
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const timeUpdateHandler = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener("timeupdate", timeUpdateHandler);
    return () => {
      video.removeEventListener("timeupdate", timeUpdateHandler);
    };
  }, [videoUrl]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />

      <main className="flex-1 flex flex-col">
        {appState === "ready" && videoUrl ? (
          <Editor
            videoUrl={videoUrl}
            videoRef={videoRef}
            transcript={transcript}
            hotspots={hotspots}
            selection={selection}
            setSelection={setSelection}
            isSuggesting={false}
            isGenerating={false}
            generatedBackground={null}
            currentTime={currentTime}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
          />
        ) : (
          <VideoUploader onFileSelect={handleFileSelect} onDemoVideoSelect={handleDemoVideoSelect} status={appState} progress={progress} />
        )}
      </main>
    </div>
  );
}
