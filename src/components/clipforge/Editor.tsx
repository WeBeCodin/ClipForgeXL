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
  handleSuggestHotspots: () => Promise<void>;
  handleGenerateBackground: (prompt: string) => Promise<void>;
  isSuggesting: boolean;
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
  handleSuggestHotspots,
  handleGenerateBackground,
  isSuggesting,
  isGenerating,
  generatedBackground,
  currentTime,
  isPlaying,
  setIsPlaying
}: EditorProps) {
  return (
    <div className="flex-1 grid md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 md:p-6 lg:p-8 h-[calc(100vh-4rem)]">
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
        handleSuggestHotspots={handleSuggestHotspots}
        handleGenerateBackground={handleGenerateBackground}
        isSuggesting={isSuggesting}
        isGenerating={isGenerating}
        generatedBackground={generatedBackground}
        transcript={transcript}
        videoRef={videoRef}
      />
    </div>
  );
}
