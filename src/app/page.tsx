
"use client";

import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/clipforge/Header";
import { VideoUploader } from "@/components/clipforge/VideoUploader";
import { Editor } from "@/components/clipforge/Editor";
import { Hotspot, Selection, TranscriptWord } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { auth, db } from "@/lib/firebase";
import { signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";


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

  // States for Firebase testing
  const [user, setUser] = useState<User | null>(null);
  const [testDocContent, setTestDocContent] = useState<string | null>(null);
  const [isTestingDb, setIsTestingDb] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  
  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

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

  const handleAnonymousSignIn = async () => {
    try {
      await signInAnonymously(auth);
      toast({ title: "Authentication Success", description: "Signed in anonymously." });
    } catch (error) {
      console.error("Anonymous sign-in error:", error);
      toast({ variant: "destructive", title: "Authentication Failed", description: "Could not sign in." });
    }
  };

  const handleDbTest = async () => {
    if (!user) {
      toast({ variant: "destructive", title: "Not Authenticated", description: "Please sign in first." });
      return;
    }
    setIsTestingDb(true);
    setTestDocContent(null);
    try {
      const testDocRef = doc(db, "test_collection", user.uid);
      const testData = {
        message: "Hello from ClipForge!",
        timestamp: Timestamp.now(),
      };
      
      // Write document
      await setDoc(testDocRef, testData);
      
      // Read document
      const docSnap = await getDoc(testDocRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setTestDocContent(`Read back: "${data.message}" at ${data.timestamp.toDate().toLocaleTimeString()}`);
        toast({ title: "Firestore Test Success", description: "Wrote and read a document." });
      } else {
        throw new Error("Document not found after writing.");
      }
    } catch (error) {
      console.error("Firestore test error:", error);
      toast({ variant: "destructive", title: "Firestore Test Failed", description: "Check the console for errors." });
      setTestDocContent("Test failed. See console for details.");
    } finally {
      setIsTestingDb(false);
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

      {/* --- PRD Step 3 Test Panel --- */}
      <div className="p-4 bg-yellow-900/50 border-b border-yellow-700 text-sm">
        <h3 className="font-bold text-lg mb-2 text-yellow-300">PRD Step 3: Firebase Integration Test</h3>
        <div className="flex items-center gap-4">
          <Button onClick={handleAnonymousSignIn} disabled={!!user}>
            {user ? "Signed In" : "1. Authenticate Anonymously"}
          </Button>
          <Button onClick={handleDbTest} disabled={!user || isTestingDb}>
            2. Write & Read Test Document
          </Button>
          <div className="flex flex-col">
            <span className="font-mono text-xs text-muted-foreground">{user ? `User ID: ${user.uid}` : "Not signed in."}</span>
            <span className="font-mono text-xs text-yellow-400">{testDocContent ?? "Firestore test not run."}</span>
          </div>
        </div>
      </div>
      {/* --- End Test Panel --- */}

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
