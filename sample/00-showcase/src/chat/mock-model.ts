import { LanguageModel, simulateReadableStream } from 'ai';

/**
 * A deterministic mock language model.
 *
 * The showcase never calls a real provider: that keeps the sample free to run
 * in CI, with no API keys to leak, and makes its streamed output assertable in
 * the smoke test. Swap this for a real provider model (e.g.
 * `openai('gpt-4o')`) in your own app — `@AiStream` does not care which model
 * produced the result.
 *
 * `simulateReadableStream` is part of the AI SDK's public API, so the mock
 * stays on supported surface. We build a minimal v3 language model around it
 * and return it through the SDK's own `LanguageModel` type.
 */
export function createMockModel(reply: string): LanguageModel {
  const words = reply.split(' ');

  const model = {
    specificationVersion: 'v4',
    provider: 'mock',
    modelId: 'mock-model',
    supportedUrls: {},
    doGenerate: () => {
      throw new Error('doGenerate is not used in this showcase');
    },
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: '1' },
          ...words.map((word, index) => ({
            type: 'text-delta',
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
        ],
      }),
    }),
  };

  return model as unknown as LanguageModel;
}
