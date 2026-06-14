# Changelog

All notable user-facing changes to `@nest-native/ai-sdk` are tracked here.

This project follows semantic versioning for the published package. Sample,
documentation, and CI-only changes may remain in `Unreleased` until the next
package release is useful for users.

## Unreleased

### Added

- `@AiStream()` method decorator: turns a Nest HTTP handler into an AI SDK
  streaming endpoint on Express while preserving the full enhancer pipeline.
  Guards, pipes, interceptors, and exception filters all run before the stream
  opens, so pre-stream rejections become HTTP errors (e.g. 401/403/429), never
  SSE error frames.
- `AiStreamOptions` with `format` (`'ui-message'` default, or `'text'`),
  per-route `headers` (merged over `AiModuleOptions.defaultHeaders`, method keys
  win), and `status`.
- `sample/00-showcase`: a full Express showcase wiring a guard, a Zod
  validation pipe, an interceptor, and an exception filter around `@AiStream`,
  with a smoke test asserting guard/pipe/filter/stream behavior.
- Express **and Fastify** adapter parity for `@AiStream`. The package writes to
  the underlying Node `ServerResponse` (Express exposes it directly; Fastify via
  `reply.raw`), so the same handler streams identically on both adapters.
- `sample/01-fastify-parity`: mounts one controller (guard + Zod pipe +
  exception filter) on both an Express app and a Fastify app, with a smoke test
  that boots both adapters and asserts the streamed payloads match byte-for-byte.
- Package-level end-to-end coverage on Fastify mirroring the Express e2e suite
  (pre-stream guard rejection, text + UI message streams, pre-stream filter).
- CI `samples` job and `release:check:sample-versions` to validate samples and
  keep their `@nest-native/ai-sdk` version pinned to the package version.
- `@AiAbortSignal()` parameter decorator: injects an `AbortSignal` derived from
  the client's connection that fires when the client disconnects mid-stream.
  Forward it into your AI SDK call (`streamText({ ..., abortSignal })`) so a
  disconnect cancels the upstream model request and stops billing. Works
  identically on Express and Fastify; the signal is derived from the underlying
  Node response and memoized so repeated `@AiAbortSignal()` resolutions share
  one controller.
- `sample/02-abort-signal`: a focused sample whose smoke test opens a stream
  with a client-side `AbortController`, disconnects mid-stream, and asserts the
  AI SDK model call is cancelled — on both Express and Fastify.

### Fixed

- Fastify streaming no longer throws `ERR_HTTP_HEADERS_SENT` when a client
  disconnects mid-stream. `@AiStream` now calls `reply.hijack()` on Fastify so
  the framework relinquishes the response lifecycle to the AI SDK; Express has
  no equivalent and is unaffected.

### Pinned

- The Vercel AI SDK (`ai`) workspace dependency is pinned to `^5` per the
  project constitution (`v5` is a hard requirement; pre-v5 unsupported). The v6
  major reworks the language-model spec and is out of scope for this milestone.

## 0.0.0 - 2026-06-13

### Added

- Initial repository scaffold (`v0.0.1-scaffold` milestone).
- npm workspace skeleton for `@nest-native/ai-sdk` with `node:test` + `c8`
  coverage (enforced at 100%), ESLint + SonarJS cognitive-complexity gate
  (threshold `15`), `tsc`-only build, package tarball validation, README link
  validation, and a high-severity supply-chain audit.
- `AiModule` shell exposing `AiModule.forRoot()` and `AiModule.forRootAsync()`,
  each returning a global `DynamicModule` that provides the resolved module
  options. The streaming primitives (`@AiStream`, `@AiAbortSignal`,
  `@AiContext`) are intentionally not yet implemented.
- CI for build, typecheck, and coverage on Node.js 20 and 22, sticky PR
  comments for coverage, test performance, and cognitive complexity, plus
  release and supply-chain checks.

The published package keeps `"dependencies": {}`. The Vercel AI SDK (`ai`) and
the NestJS packages are declared as `peerDependencies`.
