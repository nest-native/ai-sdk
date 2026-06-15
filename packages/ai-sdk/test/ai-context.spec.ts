import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import type { ServerResponse } from 'node:http';
import { ExecutionContext } from '@nestjs/common';
import { resolveAiExecutionContext } from '../ai-context';
import {
  AiContext,
  aiContextFactory,
} from '../decorators/ai-context.decorator';

/**
 * A fake Node response that lets the test drive the lifecycle events the context
 * resolver's abort signal listens for (`finish` / `close`) and toggle the
 * terminal flags it reads before binding listeners.
 */
class FakeResponse extends EventEmitter {
  writableEnded = false;
  destroyed = false;

  close(): void {
    this.emit('close');
  }

  asServerResponse(): ServerResponse {
    return this as unknown as ServerResponse;
  }
}

function createContext(
  request: unknown,
  response: unknown,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
      getResponse: <T>() => response as T,
    }),
  } as unknown as ExecutionContext;
}

describe('resolveAiExecutionContext', () => {
  it('bundles the request, response, and disconnect signal for Express', () => {
    const request = { user: { id: 'u1' }, headers: { authorization: 'k' } };
    const response = new FakeResponse();

    const context = resolveAiExecutionContext(
      request,
      response.asServerResponse(),
    );

    assert.equal(context.request, request);
    assert.equal(context.response, response);
    assert.equal(context.signal.aborted, false);

    // The signal is the live client-disconnect signal.
    response.close();
    assert.equal(context.signal.aborted, true);
  });

  it('derives the signal through the Fastify reply.raw response', () => {
    const raw = new FakeResponse();
    const reply = { raw: raw.asServerResponse() };
    const request = { id: 'fastify-request' };

    const context = resolveAiExecutionContext(request, reply as never);

    assert.equal(context.request, request);
    // The bundled response is the original platform response, not the raw one.
    assert.equal(context.response, reply);

    raw.close();
    assert.equal(context.signal.aborted, true);
  });

  it('memoizes the context across repeated resolutions of one response', () => {
    const response = new FakeResponse();

    const first = resolveAiExecutionContext({ id: 1 }, response.asServerResponse());
    const second = resolveAiExecutionContext(
      { id: 2 },
      response.asServerResponse(),
    );

    // Same object back, and the first request wins (the memoized context is the
    // single per-request object).
    assert.equal(first, second);
    assert.deepEqual(first.request, { id: 1 });
    // A single disconnect listener pair despite two resolutions.
    assert.equal(response.listenerCount('close'), 1);
  });

  it('returns an already-aborted signal when the response already ended', () => {
    const response = new FakeResponse();
    response.writableEnded = true;

    const context = resolveAiExecutionContext(
      {},
      response.asServerResponse(),
    );

    assert.equal(context.signal.aborted, true);
  });
});

describe('aiContextFactory', () => {
  it('resolves the context from the active request and response', () => {
    const request = { user: { id: 'u2' } };
    const response = new FakeResponse();
    const execution = createContext(request, response);

    const context = aiContextFactory(undefined, execution);

    assert.equal(context.request, request);
    assert.equal(context.response, response);
    assert.equal(context.signal.aborted, false);
    response.close();
    assert.equal(context.signal.aborted, true);
  });

  it('resolves through the Fastify reply.raw response', () => {
    const raw = new FakeResponse();
    const request = { id: 'fastify' };
    const execution = createContext(request, { raw });

    const context = aiContextFactory(undefined, execution);
    raw.close();

    assert.equal(context.request, request);
    assert.equal(context.signal.aborted, true);
  });
});

describe('@AiContext', () => {
  it('is a parameter decorator factory', () => {
    assert.equal(typeof AiContext, 'function');
    assert.equal(typeof AiContext(), 'function');
  });
});
