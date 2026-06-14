import { jsonSchema } from 'ai';
import { z } from 'zod';

/**
 * Input schema for the `streamObject` endpoint.
 *
 * The handler *input* is validated with Zod (via `ZodValidationPipe`) — the same
 * Zod path the other samples use. Validation runs *before* `@AiStream` opens the
 * stream, so a bad request is an HTTP 400 (a pre-stream error), never a half-open
 * stream carrying a partial object. Pipes validate inputs only — never the
 * streaming output.
 */
export const recipeRequestSchema = z.object({
  dish: z
    .string()
    .trim()
    .min(1, 'dish must not be empty')
    .max(120, 'dish must be at most 120 characters'),
});

export type RecipeRequest = z.infer<typeof recipeRequestSchema>;

/**
 * The structured object the model streams.
 */
export interface Recipe {
  name: string;
  ingredients: string[];
  steps: string[];
}

/**
 * The output schema handed to `streamObject` so it can validate the model's text
 * deltas into a typed, progressively-completed object that `@ai-sdk/react`'s
 * `useObject` hook consumes.
 *
 * This uses the AI SDK's `jsonSchema()` helper rather than a Zod schema. A Zod
 * schema works at runtime, but its recursive `z.infer` inference makes
 * TypeScript exceed its instantiation-depth limit inside `streamObject`'s
 * heavily-generic overloads (`error TS2589`). `jsonSchema<T>()` is a first-class
 * AI SDK API that carries the result type as an explicit generic, so it is the
 * idiomatic, type-safe way to declare a `streamObject` schema here. (Zod stays
 * the validator for the request input above.)
 */
export const recipeSchema = jsonSchema<Recipe>({
  type: 'object',
  properties: {
    name: { type: 'string' },
    ingredients: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
  },
  required: ['name', 'ingredients', 'steps'],
  additionalProperties: false,
});
