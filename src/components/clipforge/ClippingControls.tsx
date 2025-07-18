"use client";

import { useState, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Selection, TranscriptWord, Transform } from "@/lib/types";
import { Sparkles, Scissors, Loader2, Wand2, Play, Pause } from "lucide-react";
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
  const { toast } = useToast();
  
  const getSelectedText = () => {
    if (!selection) return "";
    return transcript
      .filter(word => word.start >= selection.start && word.end <= selection.end)
      .map(word => word.punctuated_word)
      .join(" ");
  };

  const handleCreateClip = () => {
    // Placeholder for clip creation logic
    console.log("Creating clip from", selection);
    toast({
        title: "Feature Not Implemented",
        description: "Clip creation will be added in a future step.",
        variant: "destructive"
    });
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
                <Button onClick={handleCreateClip} size="lg" className="flex-1">
                    Create Clip
                </Button>
              </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
