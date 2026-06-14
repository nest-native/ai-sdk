import type { ServerResponse } from 'node:http';
import { resolveServerResponse } from './ai-stream-writer';
import { AiPlatformResponse } from './interfaces';

/**
 * Property used to memoize the resolved {@link AbortSignal} on the platform
 * response so that multiple `@AiAbortSignal()` parameters on the same handler
 * (or repeated resolutions) all observe a single controller.
 */
const AI_ABORT_SIGNAL = Symbol('nest-native:ai-sdk:abort-signal');

interface AbortSignalCarrier {
  [AI_ABORT_SIGNAL]?: AbortSignal;
}

/**
 * Resolve an {@link AbortSignal} that fires when the client disconnects.
 *
 * The signal is derived from the active response's lifecycle: the AI SDK writes
 * the stream to the underlying Node `ServerResponse`, and when the client goes
 * away mid-stream that response emits `close` *before* it has `finish`ed.
 * Handlers forward this signal to the AI SDK call (e.g.
 * `streamText({ ..., abortSignal })`) so a client disconnect cancels the
 * upstream model request and stops billing.
 *
 * Using the response (not the request) is deliberate: the request stream can
 * `close` as soon as its body is read — long before the client disconnects — so
 * it is not a reliable disconnect signal during streaming. The response only
 * closes early when the socket is actually torn down.
 *
 * The signal is memoized on the response: calling this repeatedly (or declaring
 * `@AiAbortSignal()` more than once) returns the same signal.
 */
export function resolveRequestAbortSignal(
  response: AiPlatformResponse | ServerResponse,
): AbortSignal {
  const serverResponse = resolveServerResponse(response);
  const carrier = serverResponse as ServerResponse & AbortSignalCarrier;
  const cached = carrier[AI_ABORT_SIGNAL];

  if (cached) {
    return cached;
  }

  const controller = new AbortController();

  if (serverResponse.writableEnded || serverResponse.destroyed) {
    controller.abort();
  } else {
    bindDisconnect(serverResponse, controller);
  }

  carrier[AI_ABORT_SIGNAL] = controller.signal;

  return controller.signal;
}

/**
 * Abort the controller when the response closes before it finishes flushing.
 *
 * `finish` marks a fully-sent response, so seeing it first means the stream
 * completed normally and there is nothing to cancel. Seeing `close` first means
 * the client tore the connection down mid-stream — that is the disconnect we
 * propagate. Either event detaches both listeners so nothing leaks.
 */
function bindDisconnect(
  response: ServerResponse,
  controller: AbortController,
): void {
  let finished = false;

  const detach = () => {
    response.removeListener('finish', onFinish);
    response.removeListener('close', onClose);
  };
  const onFinish = () => {
    finished = true;
    detach();
  };
  const onClose = () => {
    detach();

    if (!finished) {
      controller.abort();
    }
  };

  response.once('finish', onFinish);
  response.once('close', onClose);
}
