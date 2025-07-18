'use server';
/**
 * @fileOverview An AI flow to suggest video hotspots from a transcript.
 *
 * - suggestHotspots - A function that finds engaging clips from a transcript.
 * - SuggestHotspotsInput - The input type for the suggestHotspots function.
 * - SuggestHotspotsOutput - The return type for the suggestHotspots function.
 */

import { ai } from '@/ai/genkit';
import { TranscriptWord } from '@/lib/types';
import { z } from 'zod';

const SuggestHotspotsInputSchema = z.object({
  transcript: z.string().describe('The full transcript of the video.'),
  words: z.array(z.object({
      word: z.string(),
      punctuated_word: z.string(),
      start: z.number(),
      end: z.number(),
  })).describe('An array of all the words in the transcript with their timestamps.'),
});
export type SuggestHotspotsInput = z.infer<typeof SuggestHotspotsInputSchema>;

const HotspotSchema = z.object({
    startWord: z.string().describe("The first word of the suggested clip."),
    endWord: z.string().describe("The last word of the suggested clip."),
    reason: z.string().describe("A short, compelling reason why this clip is interesting."),
});

const SuggestHotspotsOutputSchema = z.array(z.object({
    startTime: z.number(),
    endTime: z.number(),
    reason: z.string(),
}));
export type SuggestHotspotsOutput = z.infer<typeof SuggestHotspotsOutputSchema>;


export async function suggestHotspots(input: SuggestHotspotsInput): Promise<SuggestHotspotsOutput> {
  return suggestHotspotsFlow(input);
}

const findWord = (wordToFind: string, words: TranscriptWord[]): TranscriptWord | undefined => {
    // Find the word, trying to match case first, then case-insensitively
    const cleanWordToFind = wordToFind.replace(/[.,!?]/g, '').toLowerCase();
    return words.find(w => w.word.toLowerCase() === cleanWordToFind || w.punctuated_word.toLowerCase() === cleanWordToFind);
};

const prompt = ai.definePrompt({
  name: 'suggestHotspotsPrompt',
  input: { schema: SuggestHotspotsInputSchema },
  output: { schema: z.object({ hotspots: z.array(HotspotSchema) }) },
  prompt: `You are a viral video editor. Your job is to analyze a video transcript and identify 3-5 short, engaging, and shareable clips.

  Analyze the following transcript:
  
  "{{transcript}}"
  
  Identify 3-5 "hotspots" that would make great video clips. For each hotspot, provide the starting word, the ending word, and a brief, compelling reason why it's a good clip.
  Focus on moments that are funny, insightful, surprising, or have strong emotional impact. Clips should be between 5 and 15 seconds long.
  
  Do not select clips that are only one or two words long. Ensure the start and end words exist in the provided transcript.
  `,
});

const suggestHotspotsFlow = ai.defineFlow(
  {
    name: 'suggestHotspotsFlow',
    inputSchema: SuggestHotspotsInputSchema,
    outputSchema: SuggestHotspotsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      return [];
    }

    const resolvedHotspots: SuggestHotspotsOutput = [];
    for (const hotspot of output.hotspots) {
      const startWordInfo = findWord(hotspot.startWord, input.words);
      const endWordInfo = findWord(hotspot.endWord, input.words);

      if (startWordInfo && endWordInfo && startWordInfo.start < endWordInfo.end) {
        resolvedHotspots.push({
          startTime: startWordInfo.start,
          endTime: endWordInfo.end,
          reason: hotspot.reason,
        });
      }
    }
    
    // Sort hotspots by start time
    return resolvedHotspots.sort((a, b) => a.startTime - b.startTime);
  }
);
