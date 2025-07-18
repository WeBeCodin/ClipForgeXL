export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  punctuated_word: string;
}

export interface Hotspot {
  startTime: number;
  endTime: number;
  title: string;
}

export interface Selection {
  start: number;
  end: number;
}

export interface Transform {
  pan: { x: number; y: number };
  zoom: number;
  aspectRatio: "16/9" | "9/16" | "1/1" | "4/5";
}
