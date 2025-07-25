export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  punctuated_word: string;
}

export interface ParsedTranscript {
  words: TranscriptWord[];
}

export class TranscriptParser {
  static async parseFile(file: File): Promise<ParsedTranscript> {
    const text = await file.text();
    const extension = file.name.toLowerCase().split('.').pop();

    switch (extension) {
      case 'srt':
        return this.parseSRT(text);
      case 'vtt':
        return this.parseVTT(text);
      case 'json':
        return this.parseJSON(text);
      case 'txt':
        return this.parseText(text);
      default:
        throw new Error(`Unsupported transcript format: ${extension}`);
    }
  }

  private static parseSRT(content: string): ParsedTranscript {
    const words: TranscriptWord[] = [];
    const blocks = content.trim().split('\n\n');

    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length < 3) continue;

      const timeLine = lines[1];
      const textLine = lines.slice(2).join(' ');

      // Parse SRT timestamp: 00:00:01,000 --> 00:00:03,000
      const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      if (!timeMatch) continue;

      const startTime = this.parseTime(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
      const endTime = this.parseTime(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);

      // Split text into words and distribute timing
      const wordsArray = textLine.split(/\s+/).filter(w => w.length > 0);
      const wordDuration = (endTime - startTime) / wordsArray.length;

      wordsArray.forEach((word, index) => {
        words.push({
          word: word.replace(/[^\w']/g, '').toLowerCase(),
          start: startTime + (index * wordDuration),
          end: startTime + ((index + 1) * wordDuration),
          punctuated_word: word
        });
      });
    }

    return { words };
  }

  private static parseVTT(content: string): ParsedTranscript {
    // Remove VTT header
    const vttContent = content.replace(/^WEBVTT\n\n/, '');
    
    const words: TranscriptWord[] = [];
    const blocks = vttContent.trim().split('\n\n');

    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length < 2) continue;

      const timeLine = lines[0];
      const textLine = lines.slice(1).join(' ');

      // Parse VTT timestamp: 00:01.000 --> 00:03.000
      const timeMatch = timeLine.match(/(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2})\.(\d{3})/);
      if (!timeMatch) continue;

      const startTime = this.parseTimeVTT(timeMatch[1], timeMatch[2], timeMatch[3]);
      const endTime = this.parseTimeVTT(timeMatch[4], timeMatch[5], timeMatch[6]);

      const wordsArray = textLine.split(/\s+/).filter(w => w.length > 0);
      const wordDuration = (endTime - startTime) / wordsArray.length;

      wordsArray.forEach((word, index) => {
        words.push({
          word: word.replace(/[^\w']/g, '').toLowerCase(),
          start: startTime + (index * wordDuration),
          end: startTime + ((index + 1) * wordDuration),
          punctuated_word: word
        });
      });
    }

    return { words };
  }

  private static parseJSON(content: string): ParsedTranscript {
    try {
      const data = JSON.parse(content);
      
      // Handle different JSON formats
      if (data.words && Array.isArray(data.words)) {
        return data as ParsedTranscript;
      }
      
      if (Array.isArray(data)) {
        return { words: data };
      }
      
      throw new Error('Invalid JSON transcript format');
    } catch (error) {
      throw new Error('Failed to parse JSON transcript: ' + error);
    }
  }

  private static parseText(content: string): ParsedTranscript {
    // Simple text file - create basic word-level timing
    const words: TranscriptWord[] = [];
    const text = content.trim();
    const wordsArray = text.split(/\s+/).filter(w => w.length > 0);
    
    // Estimate 2 words per second
    const wordsPerSecond = 2;
    const wordDuration = 1 / wordsPerSecond;

    wordsArray.forEach((word, index) => {
      words.push({
        word: word.replace(/[^\w']/g, '').toLowerCase(),
        start: index * wordDuration,
        end: (index + 1) * wordDuration,
        punctuated_word: word
      });
    });

    return { words };
  }

  private static parseTime(hours: string, minutes: string, seconds: string, milliseconds: string): number {
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000;
  }

  private static parseTimeVTT(minutes: string, seconds: string, milliseconds: string): number {
    return parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000;
  }
}
