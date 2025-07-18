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
