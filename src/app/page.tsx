
"use client";

import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/clipforge/Header";
import { VideoUploader } from "@/components/clipforge/VideoUploader";
import { Editor } from "@/components/clipforge/Editor";
import { Hotspot, Selection, TranscriptWord } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { app, auth, db, storage } from "@/lib/firebase";
import { signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';


function parseTranscript(text: string): TranscriptWord[] {
  // This is a placeholder parser. A real implementation would be more complex
  // and would need word-level timestamps from the transcription API if available.
  // For now, we split by space and assign arbitrary even durations.
  const words = text.split(/\s+/);
  let currentTime = 0;
  return words.map((word, index) => {
    const start = currentTime;
    const end = start + 0.5; // Arbitrary duration
    currentTime = end + 0.1; // Arbitrary gap
    return {
      word: word.replace(/[.,!?]/g, ''),
      punctuated_word: word,
      start,
      end,
    };
  });
}

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
                    setTranscript(parseTranscript(data.transcription));
                    // Get the downloadable URL for the original video to play it
                    getDownloadURL(ref(storage, data.gcsPath.replace(`gs://${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/`, '')))
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const timeUpdateHandler = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener("timeupdate", timeUpdateHandler);
    return () => {
      video.removeEventListener("timeupdate", timeUpdateHandler);
       if (unsubscribeFirestoreRef.current) {
        unsubscribeFirestoreRef.current();
      }
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
