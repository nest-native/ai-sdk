import { LanguageModel, simulateReadableStream } from 'ai';

/**
 * A deterministic, offline mock language model for the migration sample.
 *
 * The official cookbook recipe wires a real provider model
 * (`'openai/gpt-4o'`). Swapping in a real model is a one-liner and `@AiStream`
 * does not care which model produced the result — but to keep this sample
 * offline (no API keys, no network) and its smoke test exact, we build a
 * minimal v3 language model around the AI SDK's public `simulateReadableStream`
 * helper, exactly as the other samples do.
 *
 * The reply echoes the migrated prompt so the before/after controllers and both
 * adapters can be asserted to produce identical streamed output.
 */
export function createMockModel(reply: string): LanguageModel {
  const words = reply.split(' ');

  const model = {
    specificationVersion: 'v4',
    provider: 'mock',
    modelId: 'migration-mock-model',
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
