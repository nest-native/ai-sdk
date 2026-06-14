import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import {
  CallHandler,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AiStreamInterceptor } from '../ai-stream.interceptor';
import {
  AiModuleOptions,
  AiStreamOptions,
  AiStreamResponseInit,
  AiStreamResult,
} from '../interfaces';

interface PipeCall {
  response: unknown;
  init: unknown;
}

/**
 * A fake Node response that emits `finish` as soon as the AI SDK "writes" to
 * it, mirroring how the real `pipe*ToResponse` helpers end the response.
 */
class FakeResponse extends EventEmitter {}

function createResult(response: FakeResponse): {
  result: AiStreamResult;
  uiCalls: PipeCall[];
  textCalls: PipeCall[];
} {
  const uiCalls: PipeCall[] = [];
  const textCalls: PipeCall[] = [];
  const result: AiStreamResult = {
    pipeUIMessageStreamToResponse(target, init) {
      uiCalls.push({ response: target, init });
      response.emit('finish');
    },
    pipeTextStreamToResponse(target, init) {
      textCalls.push({ response: target, init });
      response.emit('finish');
    },
  };

  return { result, uiCalls, textCalls };
}

function createContext(response: unknown): ExecutionContext {
  const handler = () => undefined;

  return {
    getHandler: () => handler,
    switchToHttp: () => ({
      getResponse: <T>() => response as T,
    }),
  } as unknown as ExecutionContext;
}

function createCallHandler(returnValue: unknown): CallHandler {
  return {
    handle: () => of(returnValue),
  };
}

function buildInterceptor(
  options: AiStreamOptions | undefined,
  moduleOptions?: AiModuleOptions,
): AiStreamInterceptor {
  const reflector = {
    get: () => options,
  } as unknown as Reflector;

  return new AiStreamInterceptor(reflector, moduleOptions);
}

describe('AiStreamInterceptor', () => {
  it('passes through untouched when the handler is not an @AiStream route', async () => {
    const interceptor = buildInterceptor(undefined);
    const handler: CallHandler = { handle: () => of('plain-value') };

    const result = await lastValueFrom(
      interceptor.intercept(createContext({}), handler),
    );

    assert.equal(result, 'plain-value');
  });

  it('pipes the UI message stream by default and resolves to undefined', async () => {
    const response = new FakeResponse();
    const { result, uiCalls } = createResult(response);
    const interceptor = buildInterceptor({});

    const emitted = await lastValueFrom(
      interceptor.intercept(
        createContext(response),
        createCallHandler(result),
      ),
    );

    assert.equal(emitted, undefined);
    assert.equal(uiCalls.length, 1);
    assert.equal(uiCalls[0]?.response, response);
    assert.deepEqual(uiCalls[0]?.init, {});
  });

  it('pipes the text stream when format is text', async () => {
    const response = new FakeResponse();
    const { result, textCalls } = createResult(response);
    const interceptor = buildInterceptor({ format: 'text' });

    await lastValueFrom(
      interceptor.intercept(
        createContext(response),
        createCallHandler(result),
      ),
    );

    assert.equal(textCalls.length, 1);
  });

  it('merges module default headers with method headers (method wins)', async () => {
    const response = new FakeResponse();
    const { result, uiCalls } = createResult(response);
    const options: AiStreamOptions = {
      headers: { 'x-ai': 'method', 'x-extra': 'method' },
    };
    const interceptor = buildInterceptor(options, {
      defaultHeaders: { 'x-ai': 'module', 'x-default': 'module' },
    });

    await lastValueFrom(
      interceptor.intercept(
        createContext(response),
        createCallHandler(result),
      ),
    );

    assert.deepEqual(uiCalls[0]?.init, {
      headers: {
        'x-ai': 'method',
        'x-extra': 'method',
        'x-default': 'module',
      },
    });
  });

  it('forwards the configured status code', async () => {
    const response = new FakeResponse();
    const { result, uiCalls } = createResult(response);
    const options: AiStreamOptions = { status: 201 };
    const interceptor = buildInterceptor(options);

    await lastValueFrom(
      interceptor.intercept(
        createContext(response),
        createCallHandler(result),
      ),
    );

    assert.deepEqual(uiCalls[0]?.init, { status: 201 });
  });

  it('awaits a promise returned by the handler', async () => {
    const response = new FakeResponse();
    const { result, uiCalls } = createResult(response);
    const interceptor = buildInterceptor({});

    await lastValueFrom(
      interceptor.intercept(
        createContext(response),
        createCallHandler(Promise.resolve(result)),
      ),
    );

    assert.equal(uiCalls.length, 1);
  });

  it('rejects when the handler returns a non-stream value', async () => {
    const interceptor = buildInterceptor({});

    await assert.rejects(
      lastValueFrom(
        interceptor.intercept(
          createContext(new FakeResponse()),
          createCallHandler({ not: 'a stream' }),
        ),
      ),
      TypeError,
    );
  });

  it('propagates a pre-stream handler error as a normal error (no pipe)', async () => {
    const interceptor = buildInterceptor({});
    const error = new Error('pre-stream failure');
    const handler: CallHandler = { handle: () => throwError(() => error) };

    await assert.rejects(
      lastValueFrom(
        interceptor.intercept(createContext(new FakeResponse()), handler),
      ),
      /pre-stream failure/,
    );
  });

  it('defaults moduleOptions to an empty object when not injected', async () => {
    const response = new FakeResponse();
    const { result, uiCalls } = createResult(response);
    const reflector = { get: () => ({}) } as unknown as Reflector;
    const interceptor = new AiStreamInterceptor(reflector);

    await lastValueFrom(
      interceptor.intercept(
        createContext(response),
        createCallHandler(result),
      ),
    );

    assert.deepEqual(uiCalls[0]?.init, {});
  });

  it('forwards the method-level onError mapper to the init', async () => {
    const response = new FakeResponse();
    const { result, uiCalls } = createResult(response);
    const onError = (error: unknown) => `method: ${String(error)}`;
    const interceptor = buildInterceptor({ onError });

    await lastValueFrom(
      interceptor.intercept(
        createContext(response),
        createCallHandler(result),
      ),
    );

    assert.equal((uiCalls[0]?.init as AiStreamResponseInit).onError, onError);
  });

  it('falls back to the module-level onError when the method has none', async () => {
    const response = new FakeResponse();
    const { result, uiCalls } = createResult(response);
    const onError = (error: unknown) => `module: ${String(error)}`;
    const interceptor = buildInterceptor({}, { onError });

    await lastValueFrom(
      interceptor.intercept(
        createContext(response),
        createCallHandler(result),
      ),
    );

    assert.equal((uiCalls[0]?.init as AiStreamResponseInit).onError, onError);
  });

  it('prefers the method-level onError over the module-level default', async () => {
    const response = new FakeResponse();
    const { result, uiCalls } = createResult(response);
    const methodOnError = (error: unknown) => `method: ${String(error)}`;
    const moduleOnError = (error: unknown) => `module: ${String(error)}`;
    const interceptor = buildInterceptor(
      { onError: methodOnError },
      { onError: moduleOnError },
    );

    await lastValueFrom(
      interceptor.intercept(
        createContext(response),
        createCallHandler(result),
      ),
    );

    assert.equal(
      (uiCalls[0]?.init as AiStreamResponseInit).onError,
      methodOnError,
    );
  });

  it('omits onError from the init when neither level configures it', async () => {
    const response = new FakeResponse();
    const { result, uiCalls } = createResult(response);
    const interceptor = buildInterceptor({});

    await lastValueFrom(
      interceptor.intercept(
        createContext(response),
        createCallHandler(result),
      ),
    );

    assert.equal('onError' in (uiCalls[0]?.init as object), false);
  });
});
