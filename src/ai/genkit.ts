/**
 * @fileoverview This file initializes and configures the Genkit AI system.
 * It sets up the necessary plugins, such as the Google AI plugin for Gemini,
 * and exports a single `ai` object that is used throughout the application
 * to define and run AI flows.
 */
import {genkit, Plugin} from 'genkit';
import {googleAI} from 'genkit/googleai';

const google = googleAI({
  apiVersion: 'v1beta',
});

export const ai = genkit({
  plugins: [google],
});
