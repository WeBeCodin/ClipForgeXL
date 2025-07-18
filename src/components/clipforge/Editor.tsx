import { Hotspot, Selection, TranscriptWord } from "@/lib/types";
import { VideoPlayer } from "./VideoPlayer";
import { Transcript } from "./Transcript";
import { ClippingControls } from "./ClippingControls";
import { RefObject } from "react";

type EditorProps = {
  videoUrl: string;
  videoRef: RefObject<HTMLVideoElement>;
  transcript: TranscriptWord[];
  hotspots: Hotspot[];
  selection: Selection | null;
  setSelection: (selection: Selection | null) => void;
  isSuggesting: boolean;
  onSuggestHotspots: () => void;
  isGenerating: boolean;
  generatedBackground: string | null;
  currentTime: number;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
};

export function Editor({
  videoUrl,
  videoRef,
  transcript,
  hotspots,
  selection,
  setSelection,
  isSuggesting,
  onSuggestHotspots,
  isGenerating,
  generatedBackground,
  currentTime,
  isPlaying,
  setIsPlaying
}: EditorProps) {
  return (
    <div className="flex-1 grid md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 md:p-6 lg:p-8 h-[calc(100vh-4rem-110px)]">
      <div className="lg:col-span-2 flex flex-col gap-4">
        <VideoPlayer
          videoUrl={videoUrl}
          videoRef={videoRef}
          selection={selection}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
        />
        <Transcript
          transcript={transcript}
          hotspots={hotspots}
          currentTime={currentTime}
          selection={selection}
          setSelection={setSelection}
          videoRef={videoRef}
        />
      </div>
      <ClippingControls
        selection={selection}
        isSuggesting={isSuggesting}
        onSuggestHotspots={onSuggestHotspots}
        isGenerating={isGenerating}
        generatedBackground={generatedBackground}
        transcript={transcript}
        videoRef={videoRef}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
      />
    </div>
  );
}
