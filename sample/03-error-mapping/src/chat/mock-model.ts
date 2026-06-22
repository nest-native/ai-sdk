import { LanguageModel, simulateReadableStream } from 'ai';

/**
 * Two offline mock language models for the error-mapping sample.
 *
 * Like every sample model these are fully offline — no provider, no API keys —
 * so they are safe to run in CI.
 */

/**
 * A model that streams a reply successfully, word by word.
 */
export function createWorkingMockModel(reply: string): LanguageModel {
  const words = reply.split(' ');
  const chunks = [
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
        inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: 0 },
        outputTokens: {
          total: words.length,
          text: words.length,
          reasoning: 0,
        },
      },
    },
  ];

  return asModel(chunks);
}

/**
 * A model that streams a few deltas and then fails *mid-stream* by emitting an
 * `error` chunk. The stream has already opened, so the failure can no longer be
 * an HTTP error — it surfaces as the AI SDK's documented in-stream error frame.
 *
 * The error message deliberately looks sensitive so the sample can prove the
 * default mapper hides it and a custom mapper rewrites it — the raw text never
 * reaches the client.
 */
export function createFailingMockModel(
  prefix: string,
  error: Error,
): LanguageModel {
  const words = prefix.split(' ');
  const chunks = [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: '1' },
    ...words.map((word, index) => ({
      type: 'text-delta',
      id: '1',
      delta: index === 0 ? word : ` ${word}`,
    })),
    { type: 'error', error },
  ];

  return asModel(chunks);
}

function asModel(chunks: unknown[]): LanguageModel {
  const model = {
    specificationVersion: 'v3',
    provider: 'mock',
    modelId: 'error-mapping-mock-model',
    supportedUrls: {},
    doGenerate: () => {
      throw new Error('doGenerate is not used in this sample');
    },
    doStream: async () => ({
      stream: simulateReadableStream({ chunks: chunks as never }),
    }),
  };

  return model as unknown as LanguageModel;
}
