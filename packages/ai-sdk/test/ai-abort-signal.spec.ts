import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import type { ServerResponse } from 'node:http';
import { resolveRequestAbortSignal } from '../ai-abort-signal';

/**
 * A fake Node response that lets the test drive the lifecycle events the abort
 * resolver listens for (`finish` / `close`) and toggle the terminal flags the
 * resolver reads before it binds listeners.
 */
class FakeResponse extends EventEmitter {
  writableEnded = false;
  destroyed = false;

  finish(): void {
    this.emit('finish');
  }

  close(): void {
    this.emit('close');
  }

  asServerResponse(): ServerResponse {
    return this as unknown as ServerResponse;
  }
}

describe('resolveRequestAbortSignal', () => {
  it('returns a non-aborted signal for a live response', () => {
    const response = new FakeResponse();

    const signal = resolveRequestAbortSignal(response.asServerResponse());

    assert.equal(signal.aborted, false);
  });

  it('aborts the signal when the response closes before finishing', () => {
    const response = new FakeResponse();
    const signal = resolveRequestAbortSignal(response.asServerResponse());

    response.close();

    assert.equal(signal.aborted, true);
  });

  it('does not abort when the response finishes normally, then closes', () => {
    const response = new FakeResponse();
    const signal = resolveRequestAbortSignal(response.asServerResponse());

    response.finish();
    // A finished response still emits `close` afterwards; that is not a
    // disconnect and must not abort the signal.
    response.close();

    assert.equal(signal.aborted, false);
  });

  it('detaches its listeners after the response finishes', () => {
    const response = new FakeResponse();
    resolveRequestAbortSignal(response.asServerResponse());

    response.finish();

    assert.equal(response.listenerCount('finish'), 0);
    assert.equal(response.listenerCount('close'), 0);
  });

  it('detaches its listeners after the client disconnects', () => {
    const response = new FakeResponse();
    resolveRequestAbortSignal(response.asServerResponse());

    response.close();

    assert.equal(response.listenerCount('finish'), 0);
    assert.equal(response.listenerCount('close'), 0);
  });

  it('returns an already-aborted signal when the response already ended', () => {
    const response = new FakeResponse();
    response.writableEnded = true;

    const signal = resolveRequestAbortSignal(response.asServerResponse());

    assert.equal(signal.aborted, true);
    // No listeners are bound for an already-terminal response.
    assert.equal(response.listenerCount('close'), 0);
  });

  it('returns an already-aborted signal when the response was destroyed', () => {
    const response = new FakeResponse();
    response.destroyed = true;

    const signal = resolveRequestAbortSignal(response.asServerResponse());

    assert.equal(signal.aborted, true);
  });

  it('memoizes the signal across repeated resolutions of one response', () => {
    const response = new FakeResponse();

    const first = resolveRequestAbortSignal(response.asServerResponse());
    const second = resolveRequestAbortSignal(response.asServerResponse());

    assert.equal(first, second);
    // Only one pair of listeners is bound despite two resolutions.
    assert.equal(response.listenerCount('close'), 1);
  });

  it('unwraps the Fastify raw response before deriving the signal', () => {
    const raw = new FakeResponse();
    const reply = { raw: raw.asServerResponse() };

    const signal = resolveRequestAbortSignal(reply as never);
    raw.close();

    assert.equal(signal.aborted, true);
  });
});
