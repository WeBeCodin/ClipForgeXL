export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  punctuated_word: string;
}

export interface Hotspot {
  startTime: number;
  endTime: number;
  reason: string;
}

export interface Selection {
  start: number;
  end: number;
}
