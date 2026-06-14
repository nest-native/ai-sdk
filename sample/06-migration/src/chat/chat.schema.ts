import { z } from 'zod';

/**
 * Input schema for the chat endpoint.
 *
 * The official AI SDK cookbook recipe is driven by `@ai-sdk/react`'s `useChat`,
 * which POSTs a `messages` array of UI messages. We validate the *inputs* before
 * they reach the AI SDK call — a safe-input / cost-control pattern — while
 * keeping the shape faithful to what `useChat` sends.
 *
 * Each message is a role plus an array of parts; we only model the `text` part
 * the recipe needs (a real app would model the full UI-message part union, but
 * the migration story is identical regardless of part richness).
 */
export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        parts: z
          .array(
            z.object({
              type: z.literal('text'),
              text: z
                .string()
                .trim()
                .min(1, 'message text must not be empty')
                .max(2000, 'message text must be at most 2000 characters'),
            }),
          )
          .min(1, 'each message needs at least one part'),
      }),
    )
    .min(1, 'messages must not be empty'),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
