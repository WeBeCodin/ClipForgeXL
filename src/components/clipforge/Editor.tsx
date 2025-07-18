import { Hotspot, Selection, TranscriptWord, Transform } from "@/lib/types";
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
  onGenerateBackground: (prompt: string) => void;
  generatedBackground: string | null;
  currentTime: number;
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
  onGenerateBackground,
  generatedBackground,
  currentTime,
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
          transcript={transcript}
          currentTime={currentTime}
          textColor={textColor}
          highlightColor={highlightColor}
          outlineColor={outlineColor}
          fontFamily={fontFamily}
          fontSize={fontSize}
          transform={transform}
          generatedBackground={generatedBackground}
        />
      </div>
      <ClippingControls
        selection={selection}
        isSuggesting={isSuggesting}
        onSuggestHotspots={onSuggestHotspots}
        isGenerating={isGenerating}
        onGenerateBackground={onGenerateBackground}
        generatedBackground={generatedBackground}
        transcript={transcript}
        videoRef={videoRef}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
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
        transform={transform}
        setTransform={setTransform}
      />
    </div>
  );
}
