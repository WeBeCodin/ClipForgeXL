"use client";

import { RefObject, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Selection, TranscriptWord, Transform } from "@/lib/types";
import { Play, Pause, Rewind, FastForward } from "lucide-react";

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
  transform: Transform;
  generatedBackground: string | null;
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
  transform,
  generatedBackground,
}: VideoPlayerProps) {
  // Convert slider value (1-5) to rem units for display
  const getDisplayFontSize = (sliderValue: number): number => {
    return sliderValue * 0.8; // 1=0.8rem, 2.5=2rem, 5=4rem
  };

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
    // Only show captions if there's a selection and we're within that timeframe
    if (!selection) return null;
    
    // Filter transcript to only include words within the selection
    const selectedTranscript = transcript.filter(word => 
      word.start >= selection.start && word.end <= selection.end
    );
    
    // Adjust current time to be relative to selection start
    const relativeTime = currentTime;
    
    // Find active word within the selected transcript
    const activeWordIndex = selectedTranscript.findIndex(word => 
      relativeTime >= word.start && relativeTime < word.end
    );
    
    if (activeWordIndex === -1) return null;
    
    // Split selected transcript into sentences
    const sentences = [];
    let currentSentence = [];
    for (const word of selectedTranscript) {
        currentSentence.push(word);
        if (word.punctuated_word.endsWith('.') || word.punctuated_word.endsWith('?') || word.punctuated_word.endsWith('!')) {
            sentences.push(currentSentence);
            currentSentence = [];
        }
    }
    if (currentSentence.length > 0) sentences.push(currentSentence);
    
    // Find the sentence that the current word belongs to
    for (const sentence of sentences) {
        if (sentence.some(word => word.start === selectedTranscript[activeWordIndex].start)) {
            return sentence;
        }
    }
    
    return null;
  };

  const currentLine = getCurrentLine();
  const [aspectRatioWidth, aspectRatioHeight] = transform.aspectRatio.split('/').map(Number);

  return (
    <Card className="overflow-hidden shadow-lg" style={{ aspectRatio: `${aspectRatioWidth} / ${aspectRatioHeight}` }}>
      <div className="relative w-full h-full bg-black">
        {generatedBackground && (
          <img src={generatedBackground} alt="AI Generated Background" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute top-1/2 left-1/2 object-contain"
          style={{
            width: `${100 * transform.zoom}%`,
            height: `${100 * transform.zoom}%`,
            transform: `translate(-50%, -50%) translate(${transform.pan.x}px, ${transform.pan.y}px)`,
          }}
        />
        
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90%] h-[15%] flex items-center justify-center">
          {currentLine && (
            <p 
              className="font-bold text-center"
              style={{
                fontFamily: fontFamily,
                fontSize: `${getDisplayFontSize(fontSize)}rem`,
                color: textColor,
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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