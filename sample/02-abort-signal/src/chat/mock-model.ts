import { LanguageModel, simulateReadableStream } from 'ai';

/**
 * A controllable mock language model for the AbortSignal sample.
 *
 * It deliberately streams slowly and records the `abortSignal` the AI SDK
 * forwards into `doStream`, so the smoke test can prove two things:
 *
 * 1. `@AiAbortSignal()` plumbs a real `AbortSignal` into the `streamText` call.
 * 2. A client disconnect mid-stream aborts that very signal — which is what
 *    tells the upstream provider to stop generating (and stop billing).
 *
 * Like every sample model it is fully offline: no provider, no API keys.
 */
export interface AbortableMockModel {
  readonly model: LanguageModel;
  /** The `abortSignal` captured from the most recent `doStream` call. */
  readonly capturedSignal: () => AbortSignal | undefined;
  /** Resolves once `doStream` has started streaming. */
  readonly started: () => Promise<void>;
  /** Resolves once the stream has been fully read or cancelled. */
  readonly settled: () => Promise<void>;
}

export function createAbortableMockModel(
  reply: string,
  chunkDelayInMs = 80,
): AbortableMockModel {
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

  let captured: AbortSignal | undefined;
  let markStarted: () => void = () => undefined;
  const startedPromise = new Promise<void>(resolve => {
    markStarted = resolve;
  });

  let markSettled: () => void = () => undefined;
  const settledPromise = new Promise<void>(resolve => {
    markSettled = resolve;
  });

  const model = {
    specificationVersion: 'v3',
    provider: 'mock',
    modelId: 'abortable-mock-model',
    supportedUrls: {},
    doGenerate: () => {
      throw new Error('doGenerate is not used in this sample');
    },
    doStream: async (options: { abortSignal?: AbortSignal }) => {
      captured = options.abortSignal;
      markStarted();

      const source = simulateReadableStream({ chunks, chunkDelayInMs });
      const reader = source.getReader();

      const stream = new ReadableStream({
        async pull(controller) {
          const { done, value } = await reader.read();

          if (done) {
            controller.close();
            markSettled();

            return;
          }

          controller.enqueue(value);
        },
        async cancel(reason) {
          await reader.cancel(reason);
          markSettled();
        },
      });

      return { stream };
    },
  };

  return {
    model: model as unknown as LanguageModel,
    capturedSignal: () => captured,
    started: () => startedPromise,
    settled: () => settledPromise,
  };
}
