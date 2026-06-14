import { z } from 'zod';

/**
 * Input schema for the chat endpoint.
 *
 * Validating the prompt here (length-bounded, trimmed) is a safe-input pattern:
 * it bounds the request before it ever reaches the AI SDK call, which is one of
 * the cost-control levers the guidelines call for.
 */
export const chatRequestSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'prompt must not be empty')
    .max(500, 'prompt must be at most 500 characters'),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
