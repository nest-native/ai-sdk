import { simulateReadableStream } from 'ai';
import type {
  LanguageModelV4,
  LanguageModelV4StreamPart,
} from '@ai-sdk/provider';

/**
 * Build a deterministic AI SDK v4 language model that streams the supplied
 * reply word-by-word.
 *
 * This avoids importing `ai/test`, whose CommonJS entry point re-exports a
 * `.ts` source path that ts-node cannot resolve. `simulateReadableStream` is
 * re-exported from the main `ai` package, so the helper stays on supported
 * public API while remaining fully offline (no provider, no API keys).
 */
export function createMockLanguageModel(reply: string): LanguageModelV4 {
  const words = reply.split(' ');
  const chunks: LanguageModelV4StreamPart[] = [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: '1' },
    ...words.map((word, index) => ({
      type: 'text-delta' as const,
      id: '1',
      delta: index === 0 ? word : ` ${word}`,
    })),
    { type: 'text-end', id: '1' },
    {
      type: 'finish',
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: {
          total: 8,
          noCache: 8,
          cacheRead: 0,
          cacheWrite: 0,
        },
        outputTokens: {
          total: words.length,
          text: words.length,
          reasoning: 0,
        },
      },
    },
  ];

  return {
    specificationVersion: 'v4',
    provider: 'mock',
    modelId: 'mock-model',
    supportedUrls: {},
    doGenerate: () => {
      throw new Error('doGenerate is not used in these tests');
    },
    doStream: async () => ({
      stream: simulateReadableStream({ chunks }),
    }),
  };
}
