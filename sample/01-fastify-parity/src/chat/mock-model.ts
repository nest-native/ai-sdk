import { LanguageModel, simulateReadableStream } from 'ai';

/**
 * A deterministic mock language model.
 *
 * Like the showcase, this focused sample never calls a real provider: the
 * point is to prove adapter parity, not model behavior. The same mock streams
 * identically regardless of whether Express or Fastify is serving the request,
 * which is exactly what lets the smoke test assert byte-for-byte parity.
 */
export function createMockModel(reply: string): LanguageModel {
  const words = reply.split(' ');

  const model = {
    specificationVersion: 'v4',
    provider: 'mock',
    modelId: 'mock-model',
    supportedUrls: {},
    doGenerate: () => {
      throw new Error('doGenerate is not used in this sample');
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
