"use client";

import { RefObject, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Selection } from "@/lib/types";
import { Play, Pause, Rewind, FastForward, Volume2, VolumeX } from "lucide-react";
import { Slider } from "../ui/slider";

type VideoPlayerProps = {
  videoUrl: string;
  videoRef: RefObject<HTMLVideoElement>;
  selection: Selection | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
};

export function VideoPlayer({ videoUrl, videoRef, selection, isPlaying, setIsPlaying }: VideoPlayerProps) {
  
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

  return (
    <Card className="overflow-hidden shadow-lg">
      <div className="relative aspect-video">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain bg-black"
        />
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
