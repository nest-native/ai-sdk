import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import { resolveAiExecutionContext } from '../ai-context';
import { AiExecutionContext, AiPlatformResponse } from '../interfaces';

/**
 * Resolve the request-scoped {@link AiExecutionContext} for the current request.
 *
 * Exported separately from the decorator so it can be unit-tested directly with
 * a synthetic {@link ExecutionContext}; `createParamDecorator` wraps the runtime
 * value in opaque metadata that is awkward to invoke in isolation.
 */
export function aiContextFactory(
  _data: unknown,
  context: ExecutionContext,
): AiExecutionContext {
  const http = context.switchToHttp();
  const request = http.getRequest<unknown>();
  const response = http.getResponse<AiPlatformResponse | ServerResponse>();

  return resolveAiExecutionContext(request, response);
}

/**
 * Parameter decorator that injects the request-scoped
 * {@link AiExecutionContext} — `{ request, response, signal }` — for the current
 * request.
 *
 * AI SDK tool `execute` closures run *inside* the stream, after the handler has
 * returned, so they cannot use ordinary Nest parameter decorators to reach the
 * current request. Capture the context in the handler and close over it instead:
 *
 * @example
 * ```ts
 * @Controller('chat')
 * export class ChatController {
 *   @Post()
 *   @AiStream()
 *   chat(@Body() body: ChatDto, @AiContext() ctx: AiExecutionContext) {
 *     return streamText({
 *       model,
 *       prompt: body.prompt,
 *       tools: {
 *         // `ctx` is captured at handler time; the tool reads request-scoped
 *         // data (auth/headers) when the model invokes it mid-stream.
 *         whoami: tool({
 *           description: 'Return the authenticated user',
 *           inputSchema: z.object({}),
 *           execute: async () => (ctx.request as { user?: unknown }).user,
 *         }),
 *       },
 *     });
 *   }
 * }
 * ```
 *
 * Works identically on Express and Fastify: `request`/`response` come from the
 * active adapter, and `signal` reuses the package's memoized client-disconnect
 * signal (the same one `@AiAbortSignal()` resolves).
 */
export const AiContext: () => ParameterDecorator =
  createParamDecorator(aiContextFactory);
