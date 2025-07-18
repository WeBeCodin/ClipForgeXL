/**
 * @fileoverview This file initializes and a new Genkit plugin for the Google AI provider.
 * It sets up the necessary plugins, such as the Google AI plugin for Gemini,
 * and exports a single `ai` object that is used throughout the application
 * to define and run AI flows.
 */
import {genkit, Plugin} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

const google = googleAI({
  apiVersion: 'v1beta',
});

export const ai = genkit({
  plugins: [google],
});
