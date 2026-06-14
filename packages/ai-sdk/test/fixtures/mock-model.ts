import { simulateReadableStream } from 'ai';
import type {
  LanguageModelV2,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider';

/**
 * Build a deterministic AI SDK v2 language model that streams the supplied
 * reply word-by-word.
 *
 * This avoids importing `ai/test`, whose CommonJS entry point re-exports a
 * `.ts` source path that ts-node cannot resolve. `simulateReadableStream` is
 * re-exported from the main `ai` package, so the helper stays on supported
 * public API while remaining fully offline (no provider, no API keys).
 */
export function createMockLanguageModel(reply: string): LanguageModelV2 {
  const words = reply.split(' ');
  const chunks: LanguageModelV2StreamPart[] = [
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
      finishReason: 'stop',
      usage: {
        inputTokens: 8,
        outputTokens: words.length,
        totalTokens: 8 + words.length,
      },
    },
  ];

  return {
    specificationVersion: 'v2',
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
