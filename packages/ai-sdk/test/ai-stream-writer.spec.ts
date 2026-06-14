import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import type { ServerResponse } from 'node:http';
import { InternalServerErrorException } from '@nestjs/common';
import {
  isAiStreamResult,
  resolveServerResponse,
  writeAiStreamToResponse,
} from '../ai-stream-writer';
import { AiStreamResult } from '../interfaces';

interface PipeCall {
  response: unknown;
  init: unknown;
}

/**
 * A fake Node response that records pipe calls and lets the test drive the
 * lifecycle events (`finish` / `close` / `error`) the writer listens for.
 */
class FakeResponse extends EventEmitter {
  finish(): void {
    this.emit('finish');
  }

  close(): void {
    this.emit('close');
  }

  fail(error: Error): void {
    this.emit('error', error);
  }
}

function createUiResult(): { result: AiStreamResult; calls: PipeCall[] } {
  const calls: PipeCall[] = [];
  const result: AiStreamResult = {
    pipeUIMessageStreamToResponse(response, init) {
      calls.push({ response, init });
    },
  };

  return { result, calls };
}

function createTextResult(): { result: AiStreamResult; calls: PipeCall[] } {
  const calls: PipeCall[] = [];
  const result: AiStreamResult = {
    pipeTextStreamToResponse(response, init) {
      calls.push({ response, init });
    },
  };

  return { result, calls };
}

describe('resolveServerResponse', () => {
  it('returns the raw Node response when present (Fastify reply)', () => {
    const raw = { id: 'raw' } as never;
    const reply = { raw };

    assert.equal(resolveServerResponse(reply as never), raw);
  });

  it('returns the response itself when there is no raw (Express)', () => {
    const response = { id: 'express' } as never;

    assert.equal(resolveServerResponse(response), response);
  });
});

describe('isAiStreamResult', () => {
  it('accepts an object exposing pipeUIMessageStreamToResponse', () => {
    assert.equal(
      isAiStreamResult({ pipeUIMessageStreamToResponse() {} }),
      true,
    );
  });

  it('accepts an object exposing pipeTextStreamToResponse', () => {
    assert.equal(isAiStreamResult({ pipeTextStreamToResponse() {} }), true);
  });

  it('rejects null', () => {
    assert.equal(isAiStreamResult(null), false);
  });

  it('rejects non-objects', () => {
    assert.equal(isAiStreamResult('streamText'), false);
    assert.equal(isAiStreamResult(42), false);
  });

  it('rejects objects without a pipe method', () => {
    assert.equal(isAiStreamResult({ toUIMessageStream() {} }), false);
  });
});

describe('writeAiStreamToResponse', () => {
  it('pipes the UI message stream and resolves once the response finishes', async () => {
    const { result, calls } = createUiResult();
    const response = new FakeResponse();

    const completion = writeAiStreamToResponse(
      result,
      response as unknown as ServerResponse,
      'ui-message',
      { status: 200, headers: { 'x-ai': 'on' } },
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.response, response);
    assert.deepEqual(calls[0]?.init, {
      status: 200,
      headers: { 'x-ai': 'on' },
    });

    response.finish();
    await completion;
  });

  it('unwraps the Fastify raw response and hijacks the reply before piping', async () => {
    const { result, calls } = createUiResult();
    const raw = new FakeResponse();
    let hijacked = 0;
    const reply = {
      raw,
      hijack: () => {
        hijacked += 1;
      },
    };

    const completion = writeAiStreamToResponse(
      result,
      reply as never,
      'ui-message',
      {},
    );

    // The raw Node response is what gets piped, and Fastify is told to step
    // back via hijack() so it does not also try to send its own reply.
    assert.equal(calls[0]?.response, raw);
    assert.equal(hijacked, 1);
    raw.finish();
    await completion;
  });

  it('does not call hijack on Express (no hijack present)', async () => {
    const { result, calls } = createUiResult();
    const response = new FakeResponse();

    const completion = writeAiStreamToResponse(
      result,
      response as unknown as ServerResponse,
      'ui-message',
      {},
    );

    // Express returns the Node response directly; there is no hijack to call,
    // and the writer must pipe to the response unchanged.
    assert.equal(calls[0]?.response, response);
    response.finish();
    await completion;
  });

  it('resolves when the client closes the connection', async () => {
    const { result } = createUiResult();
    const response = new FakeResponse();

    const completion = writeAiStreamToResponse(
      result,
      response as unknown as ServerResponse,
      'ui-message',
      {},
    );

    response.close();
    await completion;
  });

  it('rejects when the response errors', async () => {
    const { result } = createUiResult();
    const response = new FakeResponse();

    const completion = writeAiStreamToResponse(
      result,
      response as unknown as ServerResponse,
      'ui-message',
      {},
    );

    response.fail(new Error('socket hang up'));
    await assert.rejects(completion, /socket hang up/);
  });

  it('pipes the text stream for the text format', async () => {
    const { result, calls } = createTextResult();
    const response = new FakeResponse();

    const completion = writeAiStreamToResponse(
      result,
      response as unknown as ServerResponse,
      'text',
      { status: 201 },
    );

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]?.init, { status: 201 });
    response.finish();
    await completion;
  });

  it('throws when ui-message is requested but the method is missing', () => {
    const { result } = createTextResult();
    const response = new FakeResponse();

    assert.throws(
      () =>
        writeAiStreamToResponse(
          result,
          response as unknown as ServerResponse,
          'ui-message',
          {},
        ),
      InternalServerErrorException,
    );
  });

  it('throws when text is requested but the method is missing', () => {
    const { result } = createUiResult();
    const response = new FakeResponse();

    assert.throws(
      () =>
        writeAiStreamToResponse(
          result,
          response as unknown as ServerResponse,
          'text',
          {},
        ),
      InternalServerErrorException,
    );
  });
});
