"use client";

import { useState, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Selection, TranscriptWord, Transform } from "@/lib/types";
import { Sparkles, Scissors, Loader2, Wand2, Play, Pause, Download, Upload } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { CaptionControls } from "./CaptionControls";
import { TransformControls } from "./TransformControls";

type ClippingControlsProps = {
  selection: Selection | null;
  isSuggesting: boolean;
  onSuggestHotspots: () => void;
  isGenerating: boolean;
  onGenerateBackground: (prompt: string) => void;
  generatedBackground: string | null;
  isRendering: boolean;
  onRender: () => void;
  transcript: TranscriptWord[];
  videoRef: RefObject<HTMLVideoElement>;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  textColor: string;
  setTextColor: (color: string) => void;
  highlightColor: string;
  setHighlightColor: (color: string) => void;
  outlineColor: string;
  setOutlineColor: (color: string) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  transform: Transform;
  setTransform: (transform: Transform) => void;
};

export function ClippingControls({
  selection,
  isSuggesting,
  onSuggestHotspots,
  isGenerating,
  onGenerateBackground,
  generatedBackground,
  isRendering,
  onRender,
  transcript,
  videoRef,
  isPlaying,
  setIsPlaying,
  textColor,
  setTextColor,
  highlightColor,
  setHighlightColor,
  outlineColor,
  setOutlineColor,
  fontFamily,
  setFontFamily,
  fontSize,
  setFontSize,
  transform,
  setTransform,
}: ClippingControlsProps) {
  const [prompt, setPrompt] = useState("");
  const [isUploadingToYouTube, setIsUploadingToYouTube] = useState(false);
  const [youTubeTitle, setYouTubeTitle] = useState('');
  const [lastRenderedClipUrl, setLastRenderedClipUrl] = useState<string | null>(null);
  const { toast } = useToast();
  
  const getSelectedText = () => {
    if (!selection) return "";
    return transcript
      .filter(word => word.start >= selection.start && word.end <= selection.end)
      .map(word => word.punctuated_word)
      .join(" ");
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // YouTube OAuth implementation (simplified - you'll need proper OAuth flow)
  const getYouTubeAccessToken = async (): Promise<string> => {
    // This is a placeholder - you'll need to implement proper YouTube OAuth
    // For now, you can use a personal access token for testing
    // In production, implement full OAuth flow with google-auth-library
    
    return new Promise((resolve, reject) => {
      // For development, you can hardcode a token or implement OAuth popup
      // Example OAuth popup implementation:
      const authUrl = `https://accounts.google.com/oauth/authorize?` +
        `client_id=${process.env.NEXT_PUBLIC_YOUTUBE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(window.location.origin + '/youtube-callback')}&` +
        `scope=https://www.googleapis.com/auth/youtube.upload&` +
        `response_type=token&` +
        `access_type=offline`;
      
      const popup = window.open(authUrl, 'youtube-auth', 'width=500,height=600');
      
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          reject(new Error('Authentication cancelled'));
        }
      }, 1000);
      
      // Listen for token from popup (you'll need to implement the callback page)
      window.addEventListener('message', (event) => {
        if (event.origin === window.location.origin && event.data.type === 'YOUTUBE_TOKEN') {
          clearInterval(checkClosed);
          popup?.close();
          resolve(event.data.token);
        }
      }, { once: true });
    });
  };

  const handleYouTubeUpload = async (clipUrl: string) => {
    setIsUploadingToYouTube(true);
    try {
      const accessToken = await getYouTubeAccessToken();
      
      const response = await fetch('/api/youtube-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipUrl,
          title: youTubeTitle || 'AI Generated Clip',
          description: `Generated with ClipForge: ${getSelectedText()}`,
          tags: ['AI', 'clips', 'podcast'],
          accessToken
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({ 
          title: "Uploaded to YouTube!", 
          description: `Video available at: ${data.youtubeUrl}` 
        });
        window.open(data.youtubeUrl, '_blank');
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('YouTube upload error:', error);
      toast({
        title: "YouTube Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingToYouTube(false);
    }
  };

  const handleRenderWithCallback = async () => {
    try {
      const result = await onRender();
      // Assuming onRender returns the clip URL or you need to modify it to do so
      // For now, we'll store it when render completes
      // You may need to modify the parent component to pass the clip URL back
    } catch (error) {
      console.error('Render failed:', error);
    }
  };

  return (
    <Card className="flex flex-col shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Create & Enhance</CardTitle>
        <CardDescription>Use AI to find moments or generate new scenes for your clips.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
        <div className="space-y-6">
          {/* AI Hotspots */}
          <div className="space-y-2">
            <h3 className="font-semibold font-headline flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent"/> AI Hotspot Suggestions</h3>
            <p className="text-sm text-muted-foreground">Let AI find the most engaging parts of your video.</p>
            <Button onClick={onSuggestHotspots} disabled={isSuggesting} className="w-full">
              {isSuggesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Suggest Hotspots
            </Button>
          </div>
          
          <TransformControls transform={transform} setTransform={setTransform} />

          <CaptionControls
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
          />

          {/* AI Background */}
          {selection && (
            <div className="space-y-4 p-4 border rounded-lg bg-card/50">
                <h3 className="font-semibold font-headline flex items-center gap-2"><Wand2 className="w-5 h-5 text-accent"/> AI Background Generator</h3>
                <p className="text-sm text-muted-foreground">Describe a new background for your selected clip.</p>
                <div className="space-y-2">
                  <Input 
                    placeholder="e.g., a futuristic cityscape at night" 
                    value={prompt} 
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isGenerating}
                  />
                  <Button onClick={() => onGenerateBackground(prompt)} disabled={!prompt || isGenerating} className="w-full">
                    {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Background
                  </Button>
                </div>
                {generatedBackground && (
                  <div className="mt-4">
                      <h4 className="font-semibold mb-2">Generated Scene:</h4>
                      <Image src={generatedBackground} alt="AI generated background" width={400} height={225} className="rounded-md" />
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Clip Creation */}
        {selection && (
          <div className="space-y-4 p-4 border-t">
             <h3 className="font-semibold font-headline flex items-center gap-2"><Scissors className="w-5 h-5"/> Your Clip</h3>
             <div className="text-sm p-3 bg-muted rounded-md max-h-24 overflow-y-auto">
                <p className="text-muted-foreground italic">"{getSelectedText()}"</p>
             </div>
             <p className="text-sm font-medium">Duration: {(selection.end - selection.start).toFixed(1)} seconds</p>
             
             <div className="flex gap-2">
                <Button onClick={handlePlayPause} size="lg" className="flex-1">
                    {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                    {isPlaying ? 'Pause' : 'Play'}
                </Button>
                <Button onClick={handleRenderWithCallback} disabled={isRendering} size="lg" className="flex-1">
                    {isRendering ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {isRendering ? 'Rendering...' : 'Download Clip'}
                </Button>
             </div>

             {/* YouTube Upload Section */}
             <div className="mt-4 p-4 border rounded-lg bg-muted/30">
               <h4 className="font-semibold mb-3 flex items-center gap-2">
                 <Upload className="w-4 h-4" />
                 Upload to YouTube
               </h4>
               <div className="space-y-3">
                 <Input
                   placeholder="YouTube video title (optional)"
                   value={youTubeTitle}
                   onChange={(e) => setYouTubeTitle(e.target.value)}
                   disabled={isUploadingToYouTube}
                 />
                 <Button 
                   onClick={() => {
                     // You'll need to modify this to get the actual clip URL
                     // For now using a placeholder - you'll need to track the last rendered clip
                     if (lastRenderedClipUrl) {
                       handleYouTubeUpload(lastRenderedClipUrl);
                     } else {
                       toast({
                         title: "No Clip Available",
                         description: "Please render a clip first before uploading to YouTube",
                         variant: "destructive",
                       });
                     }
                   }}
                   disabled={isUploadingToYouTube || !lastRenderedClipUrl} 
                   size="lg" 
                   className="w-full"
                   variant="outline"
                 >
                   {isUploadingToYouTube ? (
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   ) : (
                     <Upload className="mr-2 h-4 w-4" />
                   )}
                   {isUploadingToYouTube ? 'Uploading to YouTube...' : 'Upload to YouTube'}
                 </Button>
                 <p className="text-xs text-muted-foreground">
                   Video will be uploaded as unlisted for review
                 </p>
               </div>
             </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}