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
 * `pipeUIMessageStreamToResponse({ response, stream, ... })` helper — the same
 * free function the cookbook's custom-data recipe calls directly.
 *
 * The wrapper lives in user code, not the package: `@nest-native/ai-sdk` keeps
 * `"dependencies": {}` and never imports AI SDK internals. Migrating the
 * cookbook's `pipeUIMessageStreamToResponse({ stream, response })` call therefore
 * becomes `return toUiMessageStreamResult(stream)` — the response is handed back
 * to the decorator instead of written by hand.
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
