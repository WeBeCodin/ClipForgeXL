// src/ai/flows/generate-background.ts
'use server';
/**
 * @fileOverview A flow that generates a new background for a video clip based on a text prompt.
 *
 * - generateBackground - A function that handles the background generation process.
 * - GenerateBackgroundInput - The input type for the generateBackground function.
 * - GenerateBackgroundOutput - The return type for the generateBackground function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateBackgroundInputSchema = z.object({
  prompt: z.string().describe('A text prompt describing the desired background.'),
  originalFrameDataUri: z.string().describe(
    'A frame from the original video, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' + 
    ' This will be used as context for generating the new background.'
  ),
});

export type GenerateBackgroundInput = z.infer<typeof GenerateBackgroundInputSchema>;

const GenerateBackgroundOutputSchema = z.object({
  generatedBackgroundDataUri: z
    .string()
    .describe(
      'The generated background image as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'
    ),
});

export type GenerateBackgroundOutput = z.infer<typeof GenerateBackgroundOutputSchema>;

export async function generateBackground(input: GenerateBackgroundInput): Promise<GenerateBackgroundOutput> {
  return generateBackgroundFlow(input);
}

const generateBackgroundPrompt = ai.definePrompt({
  name: 'generateBackgroundPrompt',
  input: {schema: GenerateBackgroundInputSchema},
  output: {schema: GenerateBackgroundOutputSchema},
  prompt: [
    {media: {url: '{{{originalFrameDataUri}}}'}},
    {text: 'Generate a new background for the above frame, based on the following description: {{{prompt}}}.'},
  ],
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
  },
});

const generateBackgroundFlow = ai.defineFlow(
  {
    name: 'generateBackgroundFlow',
    inputSchema: GenerateBackgroundInputSchema,
    outputSchema: GenerateBackgroundOutputSchema,
  },
  async input => {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: [
        {media: {url: input.originalFrameDataUri}},
        {text: `generate an image of this scene with a background of ${input.prompt}`},
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media?.url) {
      throw new Error('No background was generated.');
    }

    return {generatedBackgroundDataUri: media.url};
  }
);
