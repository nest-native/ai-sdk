import type { ServerResponse } from 'node:http';
import {
  pipeUIMessageStreamToResponse,
  type UIMessageChunk,
} from 'ai';

/**
 * Bridges a raw `createUIMessageStream` `ReadableStream` into the structural
 * shape `@AiStream` serializes.
 *
 * `@AiStream` accepts any value exposing `pipeUIMessageStreamToResponse(response,
 * init)` — the contract `streamText` results already satisfy. A
 * `createUIMessageStream` call, by contrast, returns a bare `ReadableStream`, so
 * this thin wrapper adapts it by delegating to the AI SDK's standalone
 * `pipeUIMessageStreamToResponse({ response, stream, ... })` helper.
 *
 * The wrapper lives in user code, not the package: `@nest-native/ai-sdk` keeps
 * `"dependencies": {}` and never imports AI SDK internals. This is the supported
 * way to serve an arbitrary UI message stream — the v5 generative-UI mechanism
 * that replaces the removed RSC `streamUI` — through the same decorator.
 */
export function toUiMessageStreamResult(
  stream: ReadableStream<UIMessageChunk>,
): {
  pipeUIMessageStreamToResponse: (
    response: ServerResponse,
    init?: { status?: number; headers?: Record<string, string> },
  ) => void;
} {
  return {
    pipeUIMessageStreamToResponse(response, init) {
      pipeUIMessageStreamToResponse({ response, stream, ...init });
    },
  };
}
