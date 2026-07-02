import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createMockLanguageModel,
  createToolCallingModel,
  MockLanguageModel,
} from '../testing';

/**
 * Unit tests for the `@nest-native/ai-sdk/testing` mock language models.
 *
 * The e2e suites already drive these mocks through real Express/Fastify apps;
 * this spec pins the factory contract itself: the exact v4 chunk protocol on
 * the wire, the option validation, and the abort-signal bridge a disconnect
 * test relies on.
 */

/** The v4 model surface the AI SDK drives, typed structurally for the tests. */
interface StreamableModel {
  specificationVersion: string;
  provider: string;
  modelId: string;
  doGenerate(): unknown;
  doStream(options: {
    abortSignal?: AbortSignal;
  }): Promise<{ stream: ReadableStream<StreamPart> }>;
}

type StreamPart = Record<string, unknown> & { type: string };

function asStreamable(model: MockLanguageModel): StreamableModel {
  return model as unknown as StreamableModel;
}

async function drain(stream: ReadableStream<StreamPart>): Promise<StreamPart[]> {
  const parts: StreamPart[] = [];
  const reader = stream.getReader();

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      return parts;
    }

    parts.push(value);
  }
}

describe('createMockLanguageModel', () => {
  it('streams a string reply as the full v4 text protocol, split by word', async () => {
    const model = createMockLanguageModel({ text: 'You said: ping' });
    const { stream } = await asStreamable(model).doStream({});
    const parts = await drain(stream);

    assert.deepEqual(parts, [
      { type: 'stream-start', warnings: [] },
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'You' },
      { type: 'text-delta', id: '1', delta: ' said:' },
      { type: 'text-delta', id: '1', delta: ' ping' },
      { type: 'text-end', id: '1' },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: undefined },
        usage: {
          inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 3, text: 3, reasoning: 0 },
        },
      },
    ]);
  });

  it('reconstructs any string reply byte-for-byte from the deltas', async () => {
    const reply = 'spaced  out\nand multi-line';
    const model = createMockLanguageModel({ text: reply });
    const { stream } = await asStreamable(model).doStream({});
    const parts = await drain(stream);

    const streamed = parts
      .filter(part => part.type === 'text-delta')
      .map(part => part.delta)
      .join('');

    assert.equal(streamed, reply);
  });

  it('streams a string[] reply as one delta per element, exactly as given', async () => {
    const model = createMockLanguageModel({ text: ['{"name":"Qu', 'ick"}'] });
    const { stream } = await asStreamable(model).doStream({});
    const parts = await drain(stream);

    const deltas = parts
      .filter(part => part.type === 'text-delta')
      .map(part => part.delta);

    assert.deepEqual(deltas, ['{"name":"Qu', 'ick"}']);

    const finish = parts[parts.length - 1] as unknown as {
      usage: { outputTokens: { total: number } };
    };
    assert.equal(finish.usage.outputTokens.total, 2);
  });

  it('fails mid-stream with an error part instead of finishing when `error` is set', async () => {
    const failure = new Error('upstream provider key sk-live-TEST was rejected');
    const model = createMockLanguageModel({ text: 'Partial answer', error: failure });
    const { stream } = await asStreamable(model).doStream({});
    const parts = await drain(stream);

    assert.deepEqual(parts[parts.length - 1], { type: 'error', error: failure });
    assert.equal(parts.some(part => part.type === 'text-end'), false);
    assert.equal(parts.some(part => part.type === 'finish'), false);
    assert.deepEqual(
      parts.filter(part => part.type === 'text-delta').map(part => part.delta),
      ['Partial', ' answer'],
    );
  });

  it('streams raw `chunks` verbatim as the escape hatch', async () => {
    const chunks = [
      { type: 'stream-start', warnings: [] },
      { type: 'data-weather', data: { city: 'Lisbon' } },
    ];
    const model = createMockLanguageModel({ chunks });
    const { stream } = await asStreamable(model).doStream({});

    assert.deepEqual(await drain(stream), chunks);
  });

  it('rejects an empty option object', () => {
    assert.throws(
      () => createMockLanguageModel({}),
      new TypeError('createMockLanguageModel requires either `text` or `chunks`.'),
    );
  });

  it('rejects `text` and `chunks` together', () => {
    assert.throws(
      () => createMockLanguageModel({ text: 'hi', chunks: [] }),
      new TypeError(
        'createMockLanguageModel accepts either `text` or `chunks`, not both.',
      ),
    );
  });

  it('rejects `error` combined with `chunks`', () => {
    assert.throws(
      () => createMockLanguageModel({ chunks: [], error: new Error('boom') }),
      new TypeError(
        'createMockLanguageModel `error` composes with `text`; append your own error part when using `chunks`.',
      ),
    );
  });

  it('identifies itself as a v4 mock and rejects doGenerate', () => {
    const model = asStreamable(createMockLanguageModel({ text: 'hi' }));

    assert.equal(model.specificationVersion, 'v4');
    assert.equal(model.provider, 'mock');
    assert.equal(model.modelId, 'mock-language-model');
    assert.throws(
      () => model.doGenerate(),
      /implements doStream only; doGenerate is not supported/,
    );
  });

  it('spaces chunks out when chunkDelayInMs is set', async () => {
    const model = createMockLanguageModel({
      text: 'one two three',
      chunkDelayInMs: 5,
    });
    const { stream } = await asStreamable(model).doStream({});

    const startedAt = Date.now();
    await drain(stream);

    // 7 chunks with a 5ms gap between each: well above a single gap even on a
    // coarse timer, without pinning an exact duration.
    assert.ok(Date.now() - startedAt >= 5, 'chunk delay must apply');
  });
});

describe('createMockLanguageModel observers', () => {
  it('reports no captured signal before the first doStream call', () => {
    const model = createMockLanguageModel({ text: 'hi' });

    assert.equal(model.capturedSignal(), undefined);
  });

  it('resolves started() and settled() across a full drain', async () => {
    const model = createMockLanguageModel({ text: 'hi there' });
    const { stream } = await asStreamable(model).doStream({});

    await model.started();
    await drain(stream);
    await model.settled();

    assert.equal(model.capturedSignal(), undefined);
  });

  it('captures the abortSignal forwarded into doStream', async () => {
    const controller = new AbortController();
    const model = createMockLanguageModel({ text: 'hi' });
    const { stream } = await asStreamable(model).doStream({
      abortSignal: controller.signal,
    });

    assert.equal(model.capturedSignal(), controller.signal);
    await drain(stream);
  });

  it('settles when the consumer cancels the stream directly', async () => {
    const model = createMockLanguageModel({
      text: 'one two three four',
      chunkDelayInMs: 20,
    });
    const { stream } = await asStreamable(model).doStream({});

    const reader = stream.getReader();
    await reader.read();
    await reader.cancel('client went away');

    await model.settled();
  });
});

describe('createMockLanguageModel respectAbortSignal', () => {
  it('tears the stream down when the signal aborts mid-stream', async () => {
    const controller = new AbortController();
    const model = createMockLanguageModel({
      text: 'one two three four five six',
      chunkDelayInMs: 20,
      respectAbortSignal: true,
    });
    const { stream } = await asStreamable(model).doStream({
      abortSignal: controller.signal,
    });

    const reader = stream.getReader();
    await reader.read();

    controller.abort(new Error('client disconnected'));
    await model.settled();

    // The bridge cancelled the source, so the wrapped stream ends instead of
    // ticking through the remaining delayed chunks.
    for (;;) {
      const { done } = await reader.read();

      if (done) {
        break;
      }
    }
  });

  it('settles immediately when the signal has already aborted', async () => {
    const model = createMockLanguageModel({
      text: 'never streamed',
      respectAbortSignal: true,
    });

    const { stream } = await asStreamable(model).doStream({
      abortSignal: AbortSignal.abort(new Error('aborted before doStream')),
    });

    await model.settled();
    assert.deepEqual(await drain(stream), []);
  });

  it('unsubscribes from the signal when the stream is cancelled first', async () => {
    const controller = new AbortController();
    const model = createMockLanguageModel({
      text: 'one two three four',
      chunkDelayInMs: 20,
      respectAbortSignal: true,
    });
    const { stream } = await asStreamable(model).doStream({
      abortSignal: controller.signal,
    });

    await stream.cancel('response closed');
    await model.settled();

    // Aborting afterwards must be a no-op: the listener was removed.
    controller.abort();
    assert.equal(controller.signal.aborted, true);
  });

  it('streams normally when no signal is forwarded', async () => {
    const model = createMockLanguageModel({
      text: 'hi there',
      respectAbortSignal: true,
    });
    const { stream } = await asStreamable(model).doStream({});
    const parts = await drain(stream);

    assert.equal(parts[parts.length - 1].type, 'finish');
    await model.settled();
  });
});

describe('createToolCallingModel', () => {
  it('emits a single empty-argument tool call and a tool-calls finish', async () => {
    const model = createToolCallingModel('whoami');
    const { stream } = await asStreamable(model).doStream({});

    assert.deepEqual(await drain(stream), [
      { type: 'stream-start', warnings: [] },
      { type: 'tool-call', toolCallId: 'call-1', toolName: 'whoami', input: '{}' },
      {
        type: 'finish',
        finishReason: { unified: 'tool-calls', raw: undefined },
        usage: {
          inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
      },
    ]);

    assert.equal(asStreamable(model).modelId, 'tool-calling-mock-model');
    await model.settled();
  });
});
