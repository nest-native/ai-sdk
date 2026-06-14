import { InternalServerErrorException } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import {
  AiPlatformResponse,
  AiStreamFormat,
  AiStreamResponseInit,
  AiStreamResult,
} from './interfaces';

/**
 * Resolve the underlying Node.js `ServerResponse` from whatever the active HTTP
 * adapter handed us.
 *
 * Express's `getResponse()` already returns the Node response. Fastify returns
 * a `FastifyReply` whose `.raw` property is the Node response. Normalizing here
 * keeps the interceptor adapter-agnostic, which is what unlocks Express +
 * Fastify parity in later milestones without touching the core decorator.
 */
export function resolveServerResponse(
  response: AiPlatformResponse | ServerResponse,
): ServerResponse {
  const raw = (response as AiPlatformResponse).raw;

  return raw ?? (response as ServerResponse);
}

/**
 * Hand the response lifecycle over to the AI SDK on adapters that need it.
 *
 * Fastify's `FastifyReply` keeps owning the response after the handler returns,
 * so once the AI SDK writes to `reply.raw` directly Fastify will *also* try to
 * send its own reply — which throws `ERR_HTTP_HEADERS_SENT`, most visibly when
 * the client disconnects mid-stream. Calling `reply.hijack()` tells Fastify to
 * step back. Express returns the Node response directly and has no `hijack`, so
 * this is a no-op there.
 */
function hijackIfSupported(
  response: AiPlatformResponse | ServerResponse,
): void {
  const hijack = (response as AiPlatformResponse).hijack;

  if (typeof hijack === 'function') {
    hijack.call(response);
  }
}

/**
 * Type guard that ensures the handler returned an AI SDK stream result (or a
 * promise of one) rather than an arbitrary value.
 *
 * It checks for the presence of at least one `pipe*ToResponse` method, which is
 * the structural contract `@AiStream` relies on.
 */
export function isAiStreamResult(value: unknown): value is AiStreamResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as AiStreamResult;

  return (
    typeof candidate.pipeUIMessageStreamToResponse === 'function' ||
    typeof candidate.pipeTextStreamToResponse === 'function'
  );
}

/**
 * Serialize an AI SDK stream result onto the active HTTP response using the
 * requested wire format.
 *
 * Delegating to the AI SDK's own `pipe*ToResponse` helpers (rather than reading
 * a raw `Readable`) preserves full protocol fidelity, exactly as the
 * constitution requires.
 *
 * The returned promise resolves once the AI SDK has finished writing and the
 * response is closed. The interceptor awaits it so that Nest never tries to
 * serialize its own (empty) handler result over a stream the AI SDK already
 * owns — which would otherwise truncate the response after the first chunk.
 */
export function writeAiStreamToResponse(
  result: AiStreamResult,
  response: AiPlatformResponse | ServerResponse,
  format: AiStreamFormat,
  init: AiStreamResponseInit,
): Promise<void> {
  const serverResponse = resolveServerResponse(response);
  const completion = awaitResponseCompletion(serverResponse);

  hijackIfSupported(response);

  if (format === 'text') {
    writeTextStream(result, serverResponse, init);
  } else {
    writeUiMessageStream(result, serverResponse, init);
  }

  return completion;
}

/**
 * Resolve once the response has fully flushed (`finish`) or the client went
 * away (`close`), and reject if the response errors before then.
 */
function awaitResponseCompletion(response: ServerResponse): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const settle = (callback: () => void) => {
      response.removeListener('finish', onFinish);
      response.removeListener('close', onClose);
      response.removeListener('error', onError);
      callback();
    };
    const onFinish = () => settle(resolve);
    const onClose = () => settle(resolve);
    const onError = (error: Error) => settle(() => reject(error));

    response.once('finish', onFinish);
    response.once('close', onClose);
    response.once('error', onError);
  });
}

function writeUiMessageStream(
  result: AiStreamResult,
  response: ServerResponse,
  init: AiStreamResponseInit,
): void {
  if (typeof result.pipeUIMessageStreamToResponse !== 'function') {
    throw new InternalServerErrorException(
      'The @AiStream handler returned a result without ' +
        'pipeUIMessageStreamToResponse(). Return a streamText/streamObject ' +
        "result, or set format: 'text'.",
    );
  }

  result.pipeUIMessageStreamToResponse(response, init);
}

function writeTextStream(
  result: AiStreamResult,
  response: ServerResponse,
  init: AiStreamResponseInit,
): void {
  if (typeof result.pipeTextStreamToResponse !== 'function') {
    throw new InternalServerErrorException(
      'The @AiStream handler returned a result without ' +
        "pipeTextStreamToResponse(), which the 'text' format requires.",
    );
  }

  // The text protocol has no error frame: `pipeTextStreamToResponse` accepts
  // only status/headers and silently drops non-text events. Forward just those
  // so we never pass an `onError` the AI SDK ignores for this format.
  const textInit: AiStreamResponseInit = {};

  if (init.status !== undefined) {
    textInit.status = init.status;
  }

  if (init.headers !== undefined) {
    textInit.headers = init.headers;
  }

  result.pipeTextStreamToResponse(response, textInit);
}
