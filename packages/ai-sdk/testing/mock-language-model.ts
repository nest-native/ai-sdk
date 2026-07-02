import { simulateReadableStream } from 'ai';
import type { LanguageModel } from 'ai';

/**
 * A raw AI SDK v4 stream part, typed structurally.
 *
 * The `ai` package does not re-export `@ai-sdk/provider`'s
 * `LanguageModelV4StreamPart` type, and this package deliberately keeps `ai` as
 * its only AI SDK peer, so the escape-hatch `chunks` option accepts plain
 * objects. The mock emits whatever it is given; the built-in `text` mode emits
 * the documented v4 protocol (`stream-start` → `text-start` → `text-delta`* →
 * `text-end` → `finish`).
 */
type MockStreamPart = Record<string, unknown>;

/**
 * Observation hooks every mock model exposes, so a test can assert on how the
 * AI SDK actually drove the model — most importantly that a client disconnect
 * propagated an `AbortSignal` into the model call (which is what stops
 * upstream billing with a real provider).
 */
export interface MockLanguageModelObservers {
  /** The `abortSignal` captured from the most recent `doStream` call. */
  capturedSignal(): AbortSignal | undefined;
  /** Resolves once `doStream` has been invoked at least once. */
  started(): Promise<void>;
  /**
   * Resolves once the model stream has been fully read or cancelled — i.e.
   * once the server has finished consuming or tearing the stream down. Await
   * it before ending a disconnect test so the aborted teardown never leaks
   * asynchronous activity past the test.
   */
  settled(): Promise<void>;
}

/**
 * The model returned by the factories below: a v4-spec language model that is
 * directly assignable to `streamText`/`streamObject`'s `model` option, carrying
 * the {@link MockLanguageModelObservers} hooks alongside the model members.
 */
export type MockLanguageModel = LanguageModel & MockLanguageModelObservers;

/**
 * Options for {@link createMockLanguageModel}. Exactly one of `text` or
 * `chunks` must be provided.
 */
export interface MockLanguageModelOptions {
  /**
   * The reply to stream as v4 protocol text.
   *
   * - A `string` is split into word deltas (`'You said: hi'` streams as
   *   `'You'`, `' said:'`, `' hi'`), reconstructing the reply byte-for-byte.
   * - A `string[]` streams one delta per element, exactly as given — e.g.
   *   fixed-size partial-JSON slices for a `streamObject` test.
   */
  text?: string | readonly string[];
  /**
   * When set (with `text`), the stream fails *mid-stream*: after the text
   * deltas it emits the AI SDK's documented in-stream `error` frame instead of
   * `text-end`/`finish`. The stream has already opened by then, so the failure
   * can no longer become an HTTP error — exactly how a provider failure
   * surfaces after the first byte.
   */
  error?: unknown;
  /**
   * Raw v4 stream parts to emit verbatim, for protocols the `text` mode does
   * not cover. Mutually exclusive with `text`.
   */
  chunks?: readonly MockStreamPart[];
  /**
   * Delay between chunks in milliseconds (default `0`). Give a disconnect test
   * a non-zero delay so the client has a window to abort *mid-stream*.
   */
  chunkDelayInMs?: number;
  /**
   * When `true`, the model observes `doStream`'s `abortSignal` and tears its
   * own stream down when the request is aborted — exactly as a real provider
   * does (that is what stops upstream billing). `simulateReadableStream` does
   * not, and from AI SDK v7 `streamText` no longer force-cancels the model
   * stream on abort (it relies on the provider honoring the signal), so a
   * disconnect test must opt in to this bridge. Default `false`.
   */
  respectAbortSignal?: boolean;
}

/**
 * Build a deterministic, fully offline AI SDK v4 language model — no provider,
 * no API keys — for streaming tests.
 *
 * `simulateReadableStream` is part of the AI SDK's public API, so the mock
 * stays on supported surface; only `doStream` is implemented, which is the
 * only member the streaming path touches.
 *
 * ```ts
 * streamText({ model: createMockLanguageModel({ text: 'Hello world' }), ... });
 * ```
 */
export function createMockLanguageModel(
  options: MockLanguageModelOptions,
): MockLanguageModel {
  return buildMockModel('mock-language-model', resolveStreamParts(options), {
    chunkDelayInMs: options.chunkDelayInMs,
    respectAbortSignal: options.respectAbortSignal,
  });
}

/**
 * Build a deterministic v4 language model that emits a single tool call for
 * `toolName` (with empty `{}` arguments) and then finishes.
 *
 * `streamText` invokes the matching tool's `execute` closure when it consumes
 * that tool-call part — which is what lets a test prove a tool `execute` can
 * read request-scoped data captured via `@AiContext`.
 */
export function createToolCallingModel(toolName: string): MockLanguageModel {
  return buildMockModel('tool-calling-mock-model', toolCallParts(toolName), {});
}

/** Validate the option combination and assemble the parts to stream. */
function resolveStreamParts(
  options: MockLanguageModelOptions,
): readonly MockStreamPart[] {
  if (options.chunks !== undefined && options.text !== undefined) {
    throw new TypeError(
      'createMockLanguageModel accepts either `text` or `chunks`, not both.',
    );
  }

  if (options.chunks !== undefined) {
    if (options.error !== undefined) {
      throw new TypeError(
        'createMockLanguageModel `error` composes with `text`; append your own error part when using `chunks`.',
      );
    }

    return options.chunks;
  }

  if (options.text === undefined) {
    throw new TypeError(
      'createMockLanguageModel requires either `text` or `chunks`.',
    );
  }

  const deltas = toTextDeltas(options.text);

  return options.error === undefined
    ? textParts(deltas)
    : failingTextParts(deltas, options.error);
}

/**
 * Split a `string` reply into word deltas (subsequent words carry their
 * leading space, so the concatenated deltas reconstruct the reply
 * byte-for-byte); pass a `string[]` through as explicit deltas.
 */
function toTextDeltas(text: string | readonly string[]): readonly string[] {
  if (typeof text === 'string') {
    return text
      .split(' ')
      .map((word, index) => (index === 0 ? word : ` ${word}`));
  }

  return text;
}

/** The full v4 text protocol: start, deltas, end, and a `stop` finish. */
function textParts(deltas: readonly string[]): MockStreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: '1' },
    ...deltas.map(delta => ({ type: 'text-delta', id: '1', delta })),
    { type: 'text-end', id: '1' },
    finishPart('stop', deltas.length),
  ];
}

/**
 * A stream that opens, emits its text deltas, and then fails in-stream with an
 * `error` part — no `text-end`, no `finish`, exactly as a provider failure
 * after the first byte.
 */
function failingTextParts(
  deltas: readonly string[],
  error: unknown,
): MockStreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: '1' },
    ...deltas.map(delta => ({ type: 'text-delta', id: '1', delta })),
    { type: 'error', error },
  ];
}

/** A single tool call followed by a `tool-calls` finish. */
function toolCallParts(toolName: string): MockStreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'tool-call', toolCallId: 'call-1', toolName, input: '{}' },
    finishPart('tool-calls', 1),
  ];
}

/** The v4 `finish` part with its nested token-usage detail objects. */
function finishPart(unified: string, outputTokens: number): MockStreamPart {
  return {
    type: 'finish',
    finishReason: { unified, raw: undefined },
    usage: {
      inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: outputTokens, text: outputTokens, reasoning: 0 },
    },
  };
}

/** A promise that a later event resolves; resolving twice is a no-op. */
interface Latch {
  readonly promise: Promise<void>;
  open(): void;
}

function createLatch(): Latch {
  let release!: () => void;
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });

  return { promise, open: () => release() };
}

/** Assemble the v4 model object and wire the observation hooks. */
function buildMockModel(
  modelId: string,
  parts: readonly MockStreamPart[],
  options: Pick<
    MockLanguageModelOptions,
    'chunkDelayInMs' | 'respectAbortSignal'
  >,
): MockLanguageModel {
  const { chunkDelayInMs = 0, respectAbortSignal = false } = options;
  const started = createLatch();
  const settled = createLatch();
  let captured: AbortSignal | undefined;

  const model = {
    specificationVersion: 'v4',
    provider: 'mock',
    modelId,
    supportedUrls: {},
    doGenerate: () => {
      throw new Error(
        `The ${modelId} mock implements doStream only; doGenerate is not supported.`,
      );
    },
    doStream: async (streamOptions: { abortSignal?: AbortSignal }) => {
      captured = streamOptions.abortSignal;
      started.open();

      const source = simulateReadableStream({
        chunks: [...parts],
        chunkDelayInMs,
      });

      return {
        stream: trackTeardown(
          source,
          settled.open,
          respectAbortSignal ? streamOptions.abortSignal : undefined,
        ),
      };
    },
    capturedSignal: () => captured,
    started: () => started.promise,
    settled: () => settled.promise,
  };

  return model as unknown as MockLanguageModel;
}

/**
 * Wrap the source stream so `onSettled` fires once it is fully drained or
 * cancelled — whichever happens first — and, when an `abortSignal` is given,
 * cancel the source the moment the signal aborts, the way a real provider
 * tears its stream down on a client disconnect.
 */
function trackTeardown(
  source: ReadableStream<MockStreamPart>,
  onSettled: () => void,
  abortSignal?: AbortSignal,
): ReadableStream<MockStreamPart> {
  const reader = source.getReader();
  const unbridgeAbort = abortSignal
    ? bridgeAbortSignal(reader, onSettled, abortSignal)
    : undefined;

  return new ReadableStream<MockStreamPart>({
    async pull(controller) {
      const { done, value } = await reader.read();

      if (done) {
        controller.close();
        onSettled();

        return;
      }

      controller.enqueue(value);
    },
    async cancel(reason) {
      unbridgeAbort?.();
      await reader.cancel(reason);
      onSettled();
    },
  });
}

/**
 * Cancel `reader` and settle as soon as `signal` aborts (immediately when it
 * already has). Returns the unsubscribe used when the stream is torn down
 * through its own `cancel` instead.
 */
function bridgeAbortSignal(
  reader: ReadableStreamDefaultReader<MockStreamPart>,
  onSettled: () => void,
  signal: AbortSignal,
): () => void {
  const settleOnAbort = (): void => {
    void reader.cancel(signal.reason);
    onSettled();
  };

  if (signal.aborted) {
    settleOnAbort();
  } else {
    signal.addEventListener('abort', settleOnAbort, { once: true });
  }

  return () => signal.removeEventListener('abort', settleOnAbort);
}
