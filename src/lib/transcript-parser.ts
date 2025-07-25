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
    const text = await this.extractTextFromFile(file);
    const extension = file.name.toLowerCase().split('.').pop();

    // Validate file is not empty
    if (!text.trim()) {
      throw new Error(`The file "${file.name}" appears to be empty.`);
    }

    switch (extension) {
      case 'srt':
        return this.parseSRT(text);
      case 'vtt':
        return this.parseVTT(text);
      case 'json':
        return this.parseJSON(text, file.name);
      case 'txt':
      case 'doc':
      case 'docx':
      case 'pdf':
        return this.parseText(text);
      default:
        throw new Error(`Unsupported transcript format: "${extension}". Supported formats are: SRT, VTT, JSON, TXT, DOC, DOCX, and PDF.`);
    }
  }

  private static async extractTextFromFile(file: File): Promise<string> {
    const extension = file.name.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'doc':
      case 'docx':
        return this.extractTextFromWord(file);
      case 'pdf':
        return this.extractTextFromPDF(file);
      default:
        return file.text();
    }
  }

  private static async extractTextFromWord(file: File): Promise<string> {
    try {
      // For browser compatibility, we'll use a different approach
      // For now, treat Word docs as plain text and ask users to copy-paste
      throw new Error(`Word document processing requires server-side support. Please save your document as a .txt file or copy the text into a .txt file for now.`);
    } catch (error) {
      throw new Error(`Failed to read Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async extractTextFromPDF(file: File): Promise<string> {
    try {
      // For browser compatibility, we'll use a different approach
      // For now, treat PDFs as plain text and ask users to copy-paste
      throw new Error(`PDF processing requires server-side support. Please copy the text from your PDF into a .txt file for now.`);
    } catch (error) {
      throw new Error(`Failed to read PDF document: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  private static parseJSON(content: string, fileName?: string): ParsedTranscript {
    try {
      // Check if content looks like JSON
      const trimmedContent = content.trim();
      if (!trimmedContent.startsWith('{') && !trimmedContent.startsWith('[')) {
        throw new Error(`File does not appear to be valid JSON. Content starts with: "${trimmedContent.substring(0, 50)}..."`);
      }

      const data = JSON.parse(content);
      
      // Handle different JSON formats
      if (data.words && Array.isArray(data.words)) {
        // Validate word structure
        if (data.words.length > 0 && !this.isValidWordFormat(data.words[0])) {
          throw new Error('JSON transcript format is incorrect. Expected words with "word", "start", "end", and "punctuated_word" properties.');
        }
        return data as ParsedTranscript;
      }
      
      if (Array.isArray(data)) {
        // Validate array structure
        if (data.length > 0 && !this.isValidWordFormat(data[0])) {
          throw new Error('JSON transcript format is incorrect. Expected array of words with "word", "start", "end", and "punctuated_word" properties.');
        }
        return { words: data };
      }
      
      throw new Error('Invalid JSON transcript format. Expected either {words: [...]} or [...]');
    } catch (error) {
      if (error instanceof SyntaxError) {
        const fileInfo = fileName ? ` in file "${fileName}"` : '';
        throw new Error(`Failed to parse JSON transcript${fileInfo}: ${error.message}`);
      }
      throw error;
    }
  }

  private static isValidWordFormat(word: any): boolean {
    return word && 
           typeof word.word === 'string' && 
           typeof word.start === 'number' && 
           typeof word.end === 'number' && 
           typeof word.punctuated_word === 'string';
  }

  private static parseText(content: string): ParsedTranscript {
    // Enhanced text parsing for documents
    const words: TranscriptWord[] = [];
    
    // Clean up the text - remove extra whitespace, normalize line breaks
    const cleanedText = content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const wordsArray = cleanedText.split(/\s+/).filter(w => w.length > 0);
    
    if (wordsArray.length === 0) {
      throw new Error('No readable text found in the document.');
    }
    
    // Estimate timing based on average speaking pace
    // Average: 150-160 words per minute = ~2.5 words per second
    const wordsPerSecond = 2.5;
    const wordDuration = 1 / wordsPerSecond;

    wordsArray.forEach((word, index) => {
      const cleanWord = word.replace(/[^\w']/g, '').toLowerCase();
      
      // Skip empty words after cleaning
      if (cleanWord.length === 0) return;
      
      words.push({
        word: cleanWord,
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
