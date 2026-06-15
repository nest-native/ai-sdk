import type { ServerResponse } from 'node:http';
import { resolveRequestAbortSignal } from './ai-abort-signal';
import { resolveServerResponse } from './ai-stream-writer';
import { AiExecutionContext, AiPlatformResponse } from './interfaces';

/**
 * Property used to memoize the resolved {@link AiExecutionContext} on the
 * platform response so that multiple `@AiContext()` parameters on the same
 * handler (or repeated resolutions) all observe a single object — and, in turn,
 * a single client-disconnect {@link AbortController}.
 */
const AI_EXECUTION_CONTEXT = Symbol('nest-native:ai-sdk:execution-context');

interface ExecutionContextCarrier {
  [AI_EXECUTION_CONTEXT]?: AiExecutionContext;
}

/**
 * Resolve the request-scoped {@link AiExecutionContext} for the active request.
 *
 * The context bundles the three things an AI SDK tool `execute` closure
 * realistically needs but cannot otherwise reach from inside the stream:
 *
 * - `request` — the adapter's request object (Express `Request` / Fastify
 *   `FastifyRequest`), so a tool can read auth, headers, params, or the
 *   authenticated user a guard attached.
 * - `response` — the active platform response, for the rare tool that needs to
 *   inspect or set response state.
 * - `signal` — the client-disconnect {@link AbortSignal} (the same one
 *   `@AiAbortSignal()` resolves), so a long-running tool can bail out when the
 *   client goes away mid-stream.
 *
 * The context is memoized on the response: calling this repeatedly (or
 * declaring `@AiContext()` more than once) returns the same object, and its
 * `signal` is the single memoized client-disconnect signal — so it never wires
 * a second `AbortController` for the same request.
 */
export function resolveAiExecutionContext(
  request: unknown,
  response: AiPlatformResponse | ServerResponse,
): AiExecutionContext {
  const serverResponse = resolveServerResponse(response);
  const carrier = serverResponse as ServerResponse & ExecutionContextCarrier;
  const cached = carrier[AI_EXECUTION_CONTEXT];

  if (cached) {
    return cached;
  }

  const context: AiExecutionContext = {
    request,
    response,
    signal: resolveRequestAbortSignal(response),
  };

  carrier[AI_EXECUTION_CONTEXT] = context;

  return context;
}
