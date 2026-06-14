import { ModuleMetadata, Provider } from '@nestjs/common';
import type { ServerResponse } from 'node:http';

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
 * The status/header init the package forwards to the AI SDK's
 * `pipe*ToResponse` helpers.
 */
export interface AiStreamResponseInit {
  status?: number;
  headers?: Record<string, string>;
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
}
