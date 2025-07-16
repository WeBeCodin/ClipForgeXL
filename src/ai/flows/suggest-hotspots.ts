'use server';

/**
 * @fileOverview Suggests 3-5 compelling clips from a video transcript for quick short-form video creation.
 *
 * - suggestHotspots - A function that analyzes a video transcript and returns suggested clips.
 * - SuggestHotspotsInput - The input type for the suggestHotspots function.
 * - SuggestHotspotsOutput - The return type for the suggestHotspots function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestHotspotsInputSchema = z.object({
  transcript: z.string().describe('The word-level timestamped transcript of the video.'),
});
export type SuggestHotspotsInput = z.infer<typeof SuggestHotspotsInputSchema>;

const SuggestHotspotsOutputSchema = z.object({
  clips: z
    .array(
      z.object({
        startTime: z.number().describe('The start time of the clip in seconds.'),
        endTime: z.number().describe('The end time of the clip in seconds.'),
        reason: z.string().describe('The reason why this clip is suggested.'),
      })
    )
    .describe('An array of suggested video clips.'),
});
export type SuggestHotspotsOutput = z.infer<typeof SuggestHotspotsOutputSchema>;

export async function suggestHotspots(input: SuggestHotspotsInput): Promise<SuggestHotspotsOutput> {
  return suggestHotspotsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestHotspotsPrompt',
  input: {schema: SuggestHotspotsInputSchema},
  output: {schema: SuggestHotspotsOutputSchema},
  prompt: `You are an AI video editor assistant. Analyze the following video transcript and suggest 3-5 compelling clips to create engaging short-form videos.

Transcript: {{{transcript}}}

For each clip, provide the start time, end time (in seconds), and a brief reason why the clip is suggested.  The reason should focus on why the clip would be engaging to viewers.

Format your response as a JSON object that matches the schema exactly.`,
});

const suggestHotspotsFlow = ai.defineFlow(
  {
    name: 'suggestHotspotsFlow',
    inputSchema: SuggestHotspotsInputSchema,
    outputSchema: SuggestHotspotsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
