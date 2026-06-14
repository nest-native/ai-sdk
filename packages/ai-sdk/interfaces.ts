import { ModuleMetadata, Provider } from '@nestjs/common';
import type { ServerResponse } from 'node:http';

/**
 * Maps an error thrown *during* stream production to the message embedded in the
 * AI SDK's in-stream error frame.
 *
 * This is the in-stream half of `@AiStream`'s error model. Once the response has
 * started streaming the HTTP status and headers are already on the wire, so a
 * mid-stream failure can no longer become an HTTP error — instead the AI SDK
 * serializes a documented error frame inside the stream protocol, and this
 * callback decides what message that frame carries.
 *
 * The AI SDK's default is `() => 'An error occurred.'`, which deliberately hides
 * server-side error details from the client to avoid leaking secrets. Supplying
 * your own mapper lets you surface a richer, *vetted* message (e.g. a stable
 * error code) — never raw provider errors, which may contain credentials.
 *
 * Pre-stream errors (thrown by guards, pipes, or the handler before the first
 * byte) are unaffected: those still propagate through the Nest enhancer pipeline
 * as HTTP errors and never reach this callback.
 */
export type AiStreamErrorMapper = (error: unknown) => string;

/**
 * Configuration for {@link AiModule.forRoot}.
 *
 * The module wires global configuration that the streaming primitives read
 * from. Method-level {@link AiStreamOptions} always take precedence over these
 * defaults.
 */
export interface AiModuleOptions {
  /**
   * Whether to register this module globally so the configuration is available
   * to every feature module without re-importing.
   *
   * @default true
   */
  isGlobal?: boolean;

  /**
   * Default headers applied to every streaming response produced by
   * `@AiStream`. Method-level headers from {@link AiStreamOptions.headers}
   * override matching keys.
   */
  defaultHeaders?: Record<string, string>;

  /**
   * Default in-stream error mapper applied to every `@AiStream` route. A
   * method-level {@link AiStreamOptions.onError} overrides it for that route.
   *
   * Applies only to the `ui-message` format, the only AI SDK stream protocol
   * with a documented error frame. The `text` format has no error frame, so the
   * mapper is ignored there (see {@link AiStreamOptions.onError}).
   *
   * When omitted, the AI SDK's secret-safe default (`'An error occurred.'`) is
   * used.
   */
  onError?: AiStreamErrorMapper;
}

/**
 * Configuration for {@link AiModule.forRootAsync}.
 */
export interface AiModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  /**
   * Whether to register this module globally.
   *
   * @default true
   */
  isGlobal?: boolean;

  /**
   * Providers to inject into {@link AiModuleAsyncOptions.useFactory}.
   */
  inject?: any[];

  /**
   * Additional providers registered alongside the resolved options.
   */
  extraProviders?: Provider[];

  /**
   * Factory that resolves the {@link AiModuleOptions} asynchronously.
   */
  useFactory: (
    ...args: any[]
  ) => AiModuleOptions | Promise<AiModuleOptions>;
}

/**
 * The wire format `@AiStream` serializes the handler's stream result with.
 *
 * - `ui-message` (default) preserves the AI SDK's UI message stream protocol
 *   via `toUIMessageStreamResponse()` / `pipeUIMessageStreamToResponse()` — the
 *   format consumed by `@ai-sdk/react`, `useChat`, and the other AI SDK UI
 *   hooks.
 * - `text` emits a plain `text/plain` delta stream via
 *   `toTextStreamResponse()` / `pipeTextStreamToResponse()`.
 */
export type AiStreamFormat = 'ui-message' | 'text';

/**
 * Options accepted by the {@link AiStream} method decorator.
 */
export interface AiStreamOptions {
  /**
   * Wire format used to serialize the handler's AI SDK stream result.
   *
   * @default 'ui-message'
   */
  format?: AiStreamFormat;

  /**
   * Extra response headers merged on top of {@link AiModuleOptions.defaultHeaders}
   * for this route. Method-level keys win on conflict.
   */
  headers?: Record<string, string>;

  /**
   * HTTP status code for the streaming response.
   *
   * @default 200
   */
  status?: number;

  /**
   * In-stream error mapper for this route. Overrides
   * {@link AiModuleOptions.onError}.
   *
   * Errors thrown *during* stream production (after the first byte) cannot
   * become HTTP errors — the status and headers are already sent — so the AI SDK
   * emits a documented error frame inside the stream instead. This callback maps
   * the thrown error to the message that frame carries.
   *
   * Only the `ui-message` format defines an error frame. For the `text` format
   * the AI SDK's `pipeTextStreamToResponse` accepts no error mapper and silently
   * drops non-text events, so this option is ignored for `format: 'text'`;
   * use `ui-message` if you need in-stream error reporting.
   *
   * When omitted (and {@link AiModuleOptions.onError} is unset), the AI SDK's
   * secret-safe default (`'An error occurred.'`) is used, so raw provider errors
   * never leak to the client.
   */
  onError?: AiStreamErrorMapper;
}

/**
 * Structural shape of an AI SDK stream result that `@AiStream` knows how to
 * serialize.
 *
 * Both `streamText` and `streamObject` results satisfy this interface, so the
 * package does not need to import concrete AI SDK classes (keeping `ai` a peer
 * dependency). A handler may return either method synchronously or a promise
 * that resolves to one.
 */
export interface AiStreamResult {
  /**
   * Writes the AI SDK UI message stream protocol to a Node.js
   * `ServerResponse` (used for the `ui-message` format).
   */
  pipeUIMessageStreamToResponse?: (
    response: ServerResponse,
    init?: AiStreamResponseInit,
  ) => void;

  /**
   * Writes a plain text delta stream to a Node.js `ServerResponse` (used for
   * the `text` format).
   */
  pipeTextStreamToResponse?: (
    response: ServerResponse,
    init?: AiStreamResponseInit,
  ) => void;
}

/**
 * The status/header/error init the package forwards to the AI SDK's
 * `pipe*ToResponse` helpers.
 *
 * `onError` is forwarded only for the `ui-message` format
 * (`pipeUIMessageStreamToResponse` accepts it via
 * `UIMessageStreamOptions`); `pipeTextStreamToResponse` accepts only the
 * `status`/`headers` `ResponseInit`, so the writer strips `onError` for the
 * `text` format.
 */
export interface AiStreamResponseInit {
  status?: number;
  headers?: Record<string, string>;
  onError?: AiStreamErrorMapper;
}

/**
 * Minimal structural view of a Node.js `ServerResponse` that the writer needs.
 *
 * Express exposes this object directly from `getResponse()`; Fastify exposes it
 * via `reply.raw`. Keeping the surface structural avoids depending on either
 * platform package at the type level.
 */
export interface AiHttpServerResponse extends ServerResponse {}

/**
 * Structural view of the platform response handed to the interceptor.
 *
 * Express returns the Node `ServerResponse` directly; Fastify returns a
 * `FastifyReply` whose `.raw` property is the underlying `ServerResponse`. The
 * writer normalizes both.
 */
export interface AiPlatformResponse {
  /**
   * Fastify exposes the raw Node response here. Express omits it.
   */
  raw?: ServerResponse;

  /**
   * Fastify's `reply.hijack()`. Calling it tells Fastify to relinquish control
   * of the response lifecycle so the AI SDK can own the raw socket. Without it,
   * Fastify still tries to send its own reply after the stream — which throws
   * `ERR_HTTP_HEADERS_SENT` when the client disconnects mid-stream. Express has
   * no equivalent (and omits this), so the writer calls it only when present.
   */
  hijack?: () => void;
}
