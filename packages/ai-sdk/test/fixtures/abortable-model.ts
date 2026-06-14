import { simulateReadableStream } from 'ai';
import type {
  LanguageModelV2,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider';

/**
 * A controllable mock model used by the disconnect e2e tests.
 *
 * Three properties matter for the AbortSignal test:
 *
 * - It records the `abortSignal` the AI SDK forwards into `doStream`, so the
 *   test can assert that a client disconnect propagates all the way to the model
 *   call (which is what stops upstream billing).
 * - It streams with a per-chunk delay, so the client has a window to disconnect
 *   *mid-stream* rather than after the whole response has already flushed.
 * - It exposes a `settled()` promise that resolves once the AI SDK has finished
 *   consuming or cancelling the model's stream. The test awaits it before
 *   letting the suite end, so the aborted teardown never leaks asynchronous
 *   activity past the test (which `node:test` would flag as a failure).
 */
export interface AbortableModel {
  readonly model: LanguageModelV2;
  /** The `abortSignal` captured from the most recent `doStream` call. */
  readonly capturedSignal: () => AbortSignal | undefined;
  /** Resolves once `doStream` has been invoked at least once. */
  readonly started: () => Promise<void>;
  /**
   * Resolves once the model stream has been fully read or cancelled, i.e. once
   * the server has finished tearing the stream down after a disconnect.
   */
  readonly settled: () => Promise<void>;
}

export function createAbortableModel(
  reply: string,
  chunkDelayInMs = 50,
): AbortableModel {
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

  let captured: AbortSignal | undefined;
  let signalStarted: () => void = () => undefined;
  const startedPromise = new Promise<void>(resolve => {
    signalStarted = resolve;
  });

  let signalSettled: () => void = () => undefined;
  const settledPromise = new Promise<void>(resolve => {
    signalSettled = resolve;
  });

  const model: LanguageModelV2 = {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'abortable-mock-model',
    supportedUrls: {},
    doGenerate: () => {
      throw new Error('doGenerate is not used in these tests');
    },
    doStream: async options => {
      captured = options.abortSignal;
      signalStarted();

      return {
        stream: trackTeardown(
          simulateReadableStream({ chunks, chunkDelayInMs }),
          signalSettled,
        ),
      };
    },
  };

  return {
    model,
    capturedSignal: () => captured,
    started: () => startedPromise,
    settled: () => settledPromise,
  };
}

/**
 * Wrap a source stream so `onSettled` fires once it is fully drained or
 * cancelled — whichever happens first. A mid-stream client disconnect cancels
 * the stream, so this resolves the moment the server tears the model call down.
 */
function trackTeardown<T>(
  source: ReadableStream<T>,
  onSettled: () => void,
): ReadableStream<T> {
  const reader = source.getReader();

  return new ReadableStream<T>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();

        if (done) {
          controller.close();
          onSettled();

          return;
        }

        controller.enqueue(value);
      } catch (error) {
        onSettled();
        throw error;
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
      onSettled();
    },
  });
}
