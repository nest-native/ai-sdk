import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import { ExecutionContext } from '@nestjs/common';
import {
  AiAbortSignal,
  aiAbortSignalFactory,
} from '../decorators/ai-abort-signal.decorator';

class FakeResponse extends EventEmitter {
  writableEnded = false;
  destroyed = false;

  close(): void {
    this.emit('close');
  }
}

function createContext(response: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getResponse: <T>() => response as T,
    }),
  } as unknown as ExecutionContext;
}

describe('aiAbortSignalFactory', () => {
  it('resolves the disconnect signal from the active response', () => {
    const response = new FakeResponse();
    const context = createContext(response);

    const signal = aiAbortSignalFactory(undefined, context);

    assert.equal(signal.aborted, false);
    response.close();
    assert.equal(signal.aborted, true);
  });

  it('resolves through the Fastify reply.raw response', () => {
    const raw = new FakeResponse();
    const context = createContext({ raw });

    const signal = aiAbortSignalFactory(undefined, context);
    raw.close();

    assert.equal(signal.aborted, true);
  });
});

describe('@AiAbortSignal', () => {
  it('is a parameter decorator factory', () => {
    assert.equal(typeof AiAbortSignal, 'function');
    assert.equal(typeof AiAbortSignal(), 'function');
  });
});
