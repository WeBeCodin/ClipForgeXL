
"use client";

import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/clipforge/Header";
import { VideoUploader } from "@/components/clipforge/VideoUploader";
import { Editor } from "@/components/clipforge/Editor";
import { Hotspot, Selection, TranscriptWord } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { suggestHotspots } from "@/ai/flows/suggest-hotspots";
import { generateBackground } from "@/ai/flows/generate-background";

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
  { start: 4.3, end: 4.7, word: "that", punctuated_word: "that" },
  { start: 4.7, end: 5.1, word: "lets", punctuated_word: "lets" },
  { start: 5.1, end: 5.3, word: "you", punctuated_word: "you" },
  { start: 5.3, end: 5.8, word: "create", punctuated_word: "create" },
  { start: 5.8, end: 6.3, word: "short-form", punctuated_word: "short-form" },
  { start: 6.3, end: 6.8, word: "video", punctuated_word: "video" },
  { start: 6.8, end: 7.3, word: "clips", punctuated_word: "clips." },
  { start: 7.8, end: 8.2, word: "It's", punctuated_word: "It's" },
  { start: 8.2, end: 8.5, word: "going", punctuated_word: "going" },
  { start: 8.5, end: 8.6, word: "to", punctuated_word: "to" },
  { start: 8.6, end: 9, word: "be", punctuated_word: "be" },
  { start: 9, end: 9.3, word: "really", punctuated_word: "really" },
  { start: 9.3, end: 9.8, word: "powerful,", punctuated_word: "powerful," },
  { start: 9.8, end: 10.2, word: "using", punctuated_word: "using" },
  { start: 10.2, end: 10.4, word: "AI", punctuated_word: "AI" },
  { start: 10.4, end: 10.7, word: "to", punctuated_word: "to" },
  { start: 10.7, end: 11.2, word: "suggest", punctuated_word: "suggest" },
  { start: 11.2, end: 11.7, word: "hotspots", punctuated_word: "hotspots" },
  { start: 11.7, end: 12, word: "and", punctuated_word: "and" },
  { start: 12, end: 12.3, word: "even", punctuated_word: "even" },
  { start: 12.3, end: 12.8, word: "generate", punctuated_word: "generate" },
  { start: 12.8, end: 13, word: "new", punctuated_word: "new" },
  { start: 13, end: 13.8, word: "backgrounds.", punctuated_word: "backgrounds." },
];
const DEMO_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

type AppState = "idle" | "uploading" | "processing" | "ready";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptWord[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBackground, setGeneratedBackground] = useState<string | null>(null);
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

  const handleSuggestHotspots = async () => {
    setIsSuggesting(true);
    try {
      const transcriptText = transcript.map(t => t.word).join(' ');
      const result = await suggestHotspots({ transcript: transcriptText });
      setHotspots(result.clips);
      toast({
        title: "AI Hotspots Generated",
        description: "Click on a suggestion to jump to that part of the video.",
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error Generating Hotspots",
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setIsSuggesting(false);
    }
  };

  const captureFrame = (video: HTMLVideoElement, time: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('Canvas context not available');

      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      }
      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
    });
  }

  const handleGenerateBackground = async (prompt: string) => {
    if (!selection || !videoRef.current) return;
    setIsGenerating(true);
    setGeneratedBackground(null);
    try {
      const originalFrameDataUri = await captureFrame(videoRef.current, selection.start);
      const result = await generateBackground({ prompt, originalFrameDataUri });
      setGeneratedBackground(result.generatedBackgroundDataUri);
      toast({
        title: "AI Background Generated!",
        description: "Check out the new scene for your clip.",
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error Generating Background",
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

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
            handleSuggestHotspots={handleSuggestHotspots}
            handleGenerateBackground={handleGenerateBackground}
            isSuggesting={isSuggesting}
            isGenerating={isGenerating}
            generatedBackground={generatedBackground}
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
