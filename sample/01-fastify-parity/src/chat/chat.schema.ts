import { z } from 'zod';

/**
 * Input schema for the chat endpoint.
 *
 * Validation is adapter-agnostic: the same Zod pipe rejects a bad prompt with
 * HTTP 400 on both Express and Fastify, before `@AiStream` ever opens a stream.
 */
export const chatRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'prompt must not be empty')
    .max(500, 'prompt must be at most 500 characters'),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
