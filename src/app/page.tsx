
"use client";

import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/clipforge/Header";
import { VideoUploader } from "@/components/clipforge/VideoUploader";
import { Editor } from "@/components/clipforge/Editor";
import { Hotspot, Selection, TranscriptWord, Transform } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { app, auth, db, storage } from "@/lib/firebase";
import { signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';

type AppState = "idle" | "authenticating" | "uploading" | "processing" | "ready" | "error";

export default function Home() {
  const [appState, setAppState] = useState<AppState>("authenticating");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptWord[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBackground, setGeneratedBackground] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  
  // Caption styling state
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [highlightColor, setHighlightColor] = useState("#FFFF00");
  const [outlineColor, setOutlineColor] = useState("#000000");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontSize, setFontSize] = useState(3);
  
  // Transformation state
  const [transform, setTransform] = useState<Transform>({
    pan: { x: 0, y: 0 },
    zoom: 1,
    aspectRatio: "16/9",
  });


  const videoRef = useRef<HTMLVideoElement>(null);
  const unsubscribeFirestoreRef = useRef<(() => void) | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAppState("idle");
      } else {
        setAppState("authenticating");
        try {
            await signInAnonymously(auth);
            // The listener will handle setting the user and app state
        } catch (error) {
            console.error("Anonymous sign-in error:", error);
            toast({ title: "Authentication Error", description: "Could not sign in.", variant: "destructive" });
            setAppState("error");
        }
      }
    });
    return () => unsubscribeAuth();
  }, [toast]);

  const handleFileSelect = (file: File) => {
    if (!user) {
        toast({ title: "Authentication Required", description: "Please wait until you are signed in to upload.", variant: "destructive" });
        return;
    }

    setAppState("uploading");
    const uniqueFileName = `${uuidv4()}_${file.name}`;
    const storagePath = `uploads/${user.uid}/${uniqueFileName}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    const videoDocId = `${user.uid}_${uniqueFileName}`;
    const videoDocRef = doc(db, "videos", videoDocId);

    // Listen for Firestore changes
    unsubscribeFirestoreRef.current = onSnapshot(videoDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            switch (data.status) {
                case "processing":
                    setAppState("processing");
                    break;
                case "completed":
                    if (Array.isArray(data.transcription)) {
                        setTranscript(data.transcription);
                    } else {
                        console.error("Firestore transcription data is not an array:", data.transcription);
                        toast({ title: "Invalid Transcript Format", description: "The transcript data is outdated. Please re-upload the video to get word-level timestamps.", variant: "destructive" });
                        setTranscript([]); // Set to empty to prevent crash
                    }
                    // Get the downloadable URL for the original video to play it
                    getDownloadURL(ref(storage, data.gcsPath))
                      .then(url => {
                        setVideoUrl(url);
                        setAppState("ready");
                      })
                      .catch(error => {
                        console.error("Error getting download URL", error);
                        toast({ title: "Playback Error", description: "Could not load video.", variant: "destructive" });
                        setAppState("error");
                      });
                    unsubscribeFirestoreRef.current?.(); // Stop listening after completion
                    break;
                case "failed":
                    toast({ title: "Transcription Failed", description: data.error || "An unknown error occurred.", variant: "destructive" });
                    setAppState("error");
                    unsubscribeFirestoreRef.current?.(); // Stop listening on failure
                    break;
            }
        }
    });

    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProgress(progress);
        },
        (error) => {
            console.error("Upload error", error);
            toast({ title: "Upload Failed", description: "Could not upload your video.", variant: "destructive" });
            setAppState("error");
            unsubscribeFirestoreRef.current?.();
        },
        () => {
            // Upload completed successfully, now waiting for processing
            toast({ title: "Upload Complete", description: "Your video is now being processed." });
        }
    );
  };

  const handleDemoVideoSelect = () => {
     toast({ title: "Demo Video Disabled", description: "This feature is not available while using the live backend.", variant: "destructive"});
  }

  const handleSuggestHotspots = async () => {
    setIsSuggesting(true);
    try {
      const response = await fetch("/api/hotspots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch hotspots");
      }

      const suggestedHotspots = await response.json();
      setHotspots(suggestedHotspots);
      toast({ title: "Hotspots Generated", description: "AI has suggested some clips for you." });
    } catch (error) {
      console.error("Error suggesting hotspots:", error);
      toast({
        title: "Failed to Suggest Hotspots",
        description: "An error occurred while analyzing the transcript.",
        variant: "destructive"
      });
    } finally {
      setIsSuggesting(false);
    }
  };
  
  const handleGenerateBackground = async (prompt: string) => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "An unknown error occurred.";
        const errorDetails = data.details || "No additional details were provided.";
        console.error(`Background generation failed: ${errorMessage}`, errorDetails);
        throw new Error(errorMessage);
      }

      setGeneratedBackground(data.backgroundUrl);
      toast({ title: "Background Generated", description: "The AI background has been applied." });
    } catch (error: any) {
      console.error("Error generating background:", error);
      toast({
        title: "Failed to Generate Background",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRender = async () => {
    if (!selection || !videoUrl) {
      toast({ title: "Cannot Render", description: "Please select a clip to render first.", variant: "destructive" });
      return;
    }

    setIsRendering(true);
    try {
      const payload = {
        videoUrl,
        transcript,
        selection,
        generatedBackground,
        captionStyle: {
          textColor,
          highlightColor,
          outlineColor,
          fontFamily,
          fontSize,
        },
        transform,
      };

      const response = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "An unknown rendering error occurred.";
        const errorDetails = data.details || "No additional details were provided.";
        console.error(`Rendering failed: ${errorMessage}`, errorDetails);
        throw new Error(errorMessage);
      }
      
      toast({ title: "Render Started", description: "Your video is being created. We'll notify you when it's ready." });

      // In a real app, you would likely open the returned URL or handle it in another way.
      // For now, we just log it.
      console.log("Rendered video URL:", data.videoUrl);
      window.open(data.videoUrl, '_blank');

    } catch (error: any) {
      console.error("Error rendering video:", error);
      toast({
        title: "Failed to Render Video",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRendering(false);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const timeUpdateHandler = () => {
      const currentTime = video.currentTime;
      setCurrentTime(currentTime);

      if (isPlaying && selection && currentTime >= selection.end) {
        video.pause();
        setIsPlaying(false);
      }
    };

    video.addEventListener("timeupdate", timeUpdateHandler);
    return () => {
      video.removeEventListener("timeupdate", timeUpdateHandler);
       if (unsubscribeFirestoreRef.current) {
        unsubscribeFirestoreRef.current();
      }
    };
  }, [videoUrl, isPlaying, selection]);

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
            isSuggesting={isSuggesting}
            onSuggestHotspots={handleSuggestHotspots}
            isGenerating={isGenerating}
            onGenerateBackground={handleGenerateBackground}
            generatedBackground={generatedBackground}
            isRendering={isRendering}
            onRender={handleRender}
            currentTime={currentTime}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            textColor={textColor}
            setTextColor={setTextColor}
            highlightColor={highlightColor}
            setHighlightColor={setHighlightColor}
            outlineColor={outlineColor}
            setOutlineColor={setOutlineColor}
            fontFamily={fontFamily}
            setFontFamily={setFontFamily}
            fontSize={fontSize}
            setFontSize={setFontSize}
            transform={transform}
            setTransform={setTransform}
          />
        ) : (
          <VideoUploader onFileSelect={handleFileSelect} onDemoVideoSelect={handleDemoVideoSelect} status={appState} progress={progress} />
        )}
      </main>
    </div>
  );
}
