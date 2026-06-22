import { simulateReadableStream } from 'ai';
import type {
  LanguageModelV3,
  LanguageModelV3StreamPart,
} from '@ai-sdk/provider';

/**
 * Build a deterministic AI SDK v2 language model that streams a few text deltas
 * and then fails *mid-stream* with the supplied error.
 *
 * This is the in-stream half of the error-mapping tests: the stream has already
 * started (status and headers are on the wire), so the failure can no longer
 * become an HTTP error — it must surface as the AI SDK's documented in-stream
 * error frame. Like the other fixtures it is fully offline (no provider, no API
 * keys).
 *
 * The `error` chunk carries a deliberately sensitive-looking message so the
 * tests can prove the default mapper hides it and a custom mapper can rewrite
 * it — without ever leaking the raw text to the client.
 */
export function createFailingLanguageModel(
  prefix: string,
  error: Error,
): LanguageModelV3 {
  const words = prefix.split(' ');
  const chunks: LanguageModelV3StreamPart[] = [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: '1' },
    ...words.map((word, index) => ({
      type: 'text-delta' as const,
      id: '1',
      delta: index === 0 ? word : ` ${word}`,
    })),
    { type: 'error', error },
  ];

  return {
    specificationVersion: 'v3',
    provider: 'mock',
    modelId: 'failing-mock-model',
    supportedUrls: {},
    doGenerate: () => {
      throw new Error('doGenerate is not used in these tests');
    },
    doStream: async () => ({
      stream: simulateReadableStream({ chunks }),
    }),
  };
}
