import { z } from 'zod';

/**
 * Input schema for the generative-UI endpoint.
 *
 * Validation runs *before* `@AiStream` opens the stream, so a bad request is an
 * HTTP 400 (a pre-stream error), never a half-open UI message stream. Pipes
 * validate inputs only — never the streaming output.
 */
export const weatherRequestSchema = z.object({
  city: z
    .string()
    .trim()
    .min(1, 'city must not be empty')
    .max(80, 'city must be at most 80 characters'),
});

export type WeatherRequest = z.infer<typeof weatherRequestSchema>;

/**
 * The structured payload carried by the custom `data-weather` UI part. In a
 * real app the client renders this with a `<WeatherCard />` component keyed off
 * the part type — the v5 replacement for the removed RSC `streamUI` that
 * returned React nodes directly.
 */
export interface WeatherCard {
  city: string;
  temperatureC: number;
  condition: string;
}
