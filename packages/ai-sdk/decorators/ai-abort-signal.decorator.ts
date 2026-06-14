import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { resolveRequestAbortSignal } from '../ai-abort-signal';
import { AiPlatformResponse } from '../interfaces';

/**
 * Resolve the client-disconnect {@link AbortSignal} for the current request.
 *
 * Exported separately from the decorator so it can be unit-tested directly with
 * a synthetic {@link ExecutionContext}; `createParamDecorator` wraps the runtime
 * value in opaque metadata that is awkward to invoke in isolation.
 */
export function aiAbortSignalFactory(
  _data: unknown,
  context: ExecutionContext,
): AbortSignal {
  const response = context
    .switchToHttp()
    .getResponse<AiPlatformResponse | ServerResponse>();

  return resolveRequestAbortSignal(response);
}

/**
 * Parameter decorator that injects an {@link AbortSignal} which fires when the
 * client disconnects mid-stream.
 *
 * Forward the signal to your AI SDK call so a disconnect cancels the upstream
 * model request (and stops billing) instead of streaming tokens into a dead
 * socket:
 *
 * @example
 * ```ts
 * @Controller('chat')
 * export class ChatController {
 *   @Post()
 *   @AiStream()
 *   chat(@Body() body: ChatDto, @AiAbortSignal() signal: AbortSignal) {
 *     // When the client aborts the fetch, `signal` aborts and the AI SDK
 *     // tears down the model request.
 *     return streamText({ model, prompt: body.prompt, abortSignal: signal });
 *   }
 * }
 * ```
 *
 * Works identically on Express and Fastify: the signal is derived from the
 * underlying Node response, which the package already normalizes across both
 * adapters.
 */
export const AiAbortSignal: () => ParameterDecorator =
  createParamDecorator(aiAbortSignalFactory);
