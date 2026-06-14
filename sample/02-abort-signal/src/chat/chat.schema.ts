import { z } from 'zod';

/**
 * Input schema for the chat endpoint.
 *
 * Validation runs before `@AiStream` opens the stream, so a bad prompt is an
 * HTTP 400 — never a half-open stream carrying an error frame. Validating
 * inputs (not the streaming output) is the supported use of pipes here.
 */
export const chatRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'prompt must not be empty')
    .max(500, 'prompt must be at most 500 characters'),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
