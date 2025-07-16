"use client";

import { useState, useRef, RefObject, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hotspot, Selection, TranscriptWord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "../ui/badge";

type TranscriptProps = {
  transcript: TranscriptWord[];
  currentTime: number;
  selection: Selection | null;
  setSelection: (selection: Selection | null) => void;
  hotspots: Hotspot[];
  videoRef: RefObject<HTMLVideoElement>;
};

export function Transcript({ transcript, currentTime, selection, setSelection, hotspots, videoRef }: TranscriptProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement>(null);

  const getWordId = (index: number) => `word-${index}`;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const wordId = target.dataset.wordId;
    if (wordId) {
      setIsSelecting(true);
      const index = parseInt(wordId, 10);
      const word = transcript[index];
      setSelection({ start: word.start, end: word.end });
    }
  };

  const handleMouseOver = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isSelecting) {
      const target = e.target as HTMLElement;
      const wordId = target.dataset.wordId;
      if (wordId && selection) {
        const index = parseInt(wordId, 10);
        const word = transcript[index];
        setSelection({ ...selection, end: word.end });
      }
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };
  
  const handleHotspotClick = (hotspot: Hotspot) => {
    setSelection({start: hotspot.startTime, end: hotspot.endTime});
    if (videoRef.current) {
        videoRef.current.currentTime = hotspot.startTime;
    }
  }

  useEffect(() => {
    if (activeWordRef.current && scrollAreaRef.current) {
      const wordEl = activeWordRef.current;
      const scrollAreaEl = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (!scrollAreaEl) return;
      const wordOffsetTop = wordEl.offsetTop;
      const scrollAreaScrollTop = scrollAreaEl.scrollTop;
      const scrollAreaHeight = scrollAreaEl.clientHeight;

      if (wordOffsetTop < scrollAreaScrollTop || wordOffsetTop > scrollAreaScrollTop + scrollAreaHeight - wordEl.clientHeight) {
        scrollAreaEl.scrollTo({
            top: wordOffsetTop - scrollAreaHeight / 2,
            behavior: 'smooth'
        });
      }
    }
  }, [currentTime]);


  return (
    <Card className="flex-1 flex flex-col shadow-lg">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-headline text-2xl">Transcript</CardTitle>
        {hotspots.length > 0 && <Badge variant="secondary">AI Hotspots Available</Badge>}
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-full pr-4" ref={scrollAreaRef}>
            <div onMouseDown={handleMouseDown} onMouseOver={handleMouseOver} onMouseUp={handleMouseUp} className="prose prose-invert max-w-none text-lg leading-relaxed cursor-pointer select-none">
            {transcript.map((word, index) => {
                const isActive = currentTime >= word.start && currentTime < word.end;
                const isSelected = selection && word.start >= selection.start && word.end <= selection.end;
                const isHotspot = hotspots.some(h => word.start >= h.startTime && word.end <= h.endTime);

                return (
                <span
                    key={index}
                    data-word-id={index}
                    ref={isActive ? activeWordRef : null}
                    className={cn(
                    "transition-colors duration-150",
                    isActive && "bg-accent text-accent-foreground rounded-md",
                    isSelected && "bg-primary/50",
                    !isSelected && isHotspot && "border-b-2 border-accent"
                    )}
                >
                    {word.punctuated_word}{' '}
                </span>
                );
            })}
            </div>
            {hotspots.length > 0 && (
                <div className="mt-4">
                    <h4 className="font-headline text-lg mb-2">AI Suggested Hotspots</h4>
                    <div className="space-y-2">
                        {hotspots.map((hotspot, i) => (
                            <button key={i} onClick={() => handleHotspotClick(hotspot)} className="w-full text-left p-3 rounded-lg bg-card hover:bg-accent/10 border border-border transition-colors">
                               <p className="font-semibold">Clip {i+1}: {hotspot.reason}</p>
                               <p className="text-sm text-muted-foreground">Duration: {(hotspot.endTime - hotspot.startTime).toFixed(1)}s</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
