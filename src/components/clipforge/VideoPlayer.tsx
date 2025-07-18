"use client";

import { RefObject, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Selection, TranscriptWord } from "@/lib/types";
import { Play, Pause, Rewind, FastForward } from "lucide-react";
import { cn } from "@/lib/utils";

type VideoPlayerProps = {
  videoUrl: string;
  videoRef: RefObject<HTMLVideoElement>;
  selection: Selection | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  transcript: TranscriptWord[];
  currentTime: number;
  textColor: string;
  highlightColor: string;
  outlineColor: string;
  fontFamily: string;
  fontSize: number;
};

export function VideoPlayer({ 
  videoUrl, 
  videoRef, 
  selection, 
  isPlaying, 
  setIsPlaying,
  transcript,
  currentTime,
  textColor,
  highlightColor,
  outlineColor,
  fontFamily,
  fontSize,
}: VideoPlayerProps) {
  
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const handleSeek = (direction: 'forward' | 'backward') => {
    const video = videoRef.current;
    if(!video) return;
    video.currentTime += direction === 'forward' ? 5 : -5;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [videoRef, setIsPlaying]);

  const getCurrentLine = () => {
    const activeWordIndex = transcript.findIndex(word => currentTime >= word.start && currentTime < word.end);
    if (activeWordIndex === -1) return null;

    let lineStart = activeWordIndex;
    while (lineStart > 0 && !transcript[lineStart - 1].punctuated_word.endsWith('.')) {
      lineStart--;
    }

    let lineEnd = activeWordIndex;
    while (lineEnd < transcript.length - 1 && !transcript[lineEnd].punctuated_word.endsWith('.')) {
      lineEnd++;
    }

    return transcript.slice(lineStart, lineEnd + 1);
  };

  const currentLine = getCurrentLine();

  return (
    <Card className="overflow-hidden shadow-lg relative">
      <div className="relative aspect-video">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain bg-black"
        />
        
        {/* Captions Overlay */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full text-center p-4">
          {currentLine && (
            <p 
              className="font-bold"
              style={{
                fontFamily: fontFamily,
                fontSize: `${fontSize}rem`,
                color: textColor,
                textShadow: `
                  -2px -2px 0 ${outlineColor},  
                   2px -2px 0 ${outlineColor},
                  -2px  2px 0 ${outlineColor},
                   2px  2px 0 ${outlineColor}
                `,
              }}
            >
              {currentLine.map((word, index) => {
                const isActive = currentTime >= word.start && currentTime < word.end;
                return (
                  <span key={index} style={{ color: isActive ? highlightColor : textColor }}>
                    {word.punctuated_word}{' '}
                  </span>
                )
              })}
            </p>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
           <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white hover:bg-white/10">
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleSeek('backward')} className="text-white hover:bg-white/10">
              <Rewind className="w-6 h-6" />
            </Button>
             <Button variant="ghost" size="icon" onClick={() => handleSeek('forward')} className="text-white hover:bg-white/10">
              <FastForward className="w-6 h-6" />
            </Button>
           </div>
        </div>
      </div>
    </Card>
  );
}
