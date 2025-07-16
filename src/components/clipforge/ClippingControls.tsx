"use client";

import { useState, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Selection, TranscriptWord } from "@/lib/types";
import { Sparkles, Scissors, Loader2, Wand2 } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";

type ClippingControlsProps = {
  selection: Selection | null;
  isSuggesting: boolean;
  isGenerating: boolean;
  generatedBackground: string | null;
  transcript: TranscriptWord[];
  videoRef: RefObject<HTMLVideoElement>;
};

export function ClippingControls({
  selection,
  isSuggesting,
  isGenerating,
  generatedBackground,
  transcript,
  videoRef
}: ClippingControlsProps) {
  const [prompt, setPrompt] = useState("");
  const { toast } = useToast();

  const handleSuggestHotspots = async () => {
    toast({
      title: "Feature Not Implemented",
      description: "AI Hotspot suggestions will be added in a future step.",
      variant: "destructive"
    });
  };

  const handleGenerateBackground = async (prompt: string) => {
     toast({
      title: "Feature Not Implemented",
      description: "AI background generation will be added in a future step.",
      variant: "destructive"
    });
  };
  
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
    alert("Clip creation initiated! (Feature not implemented)");
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
            <Button onClick={handleSuggestHotspots} disabled={isSuggesting} className="w-full">
              {isSuggesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Suggest Hotspots
            </Button>
          </div>

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
                  <Button onClick={() => handleGenerateBackground(prompt)} disabled={!prompt || isGenerating} className="w-full">
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
             <Button onClick={handleCreateClip} size="lg" className="w-full">
                Create Clip
             </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
