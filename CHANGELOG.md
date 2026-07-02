# Changelog

All notable user-facing changes to `@nest-native/ai-sdk` are tracked here.

This project follows semantic versioning for the published package. Sample,
documentation, and CI-only changes may remain in `Unreleased` until the next
package release is useful for users.

## Unreleased

## 0.5.0 - 2026-07-01

Ships a public testing entrypoint and aligns the supported Node.js line with
the AI SDK's own engines requirement.

### Changed (breaking)

- **Node.js support is now `>=22`** (was `>=20`). `ai@7`, `@ai-sdk/provider@4`,
  and the `@ai-sdk/*` provider packages all declare `engines.node: '>=22'`, so
  `>=20` overstated what the peer stack can actually deliver — a Node 20
  install already warned (or failed under `engine-strict`) at the `ai` peer.
  The `engines` field now states the real requirement, the documented support
  line follows it, and CI no longer tests Node 20.

### Added

- **`@nest-native/ai-sdk/testing`** — deterministic, fully offline AI SDK v4
  mock language models for streaming tests, replacing the hand-rolled
  v4-chunk-boilerplate mocks previously copied across every sample and the
  package's own test fixtures. `createMockLanguageModel({ text | chunks,
  error?, chunkDelayInMs?, respectAbortSignal? })` streams word deltas from a
  `string` (or exact deltas from a `string[]`), can fail mid-stream with the
  documented in-stream `error` frame, and can honor `doStream`'s `abortSignal`
  the way a real provider does; every model exposes
  `capturedSignal()`/`started()`/`settled()` observers for disconnect tests.
  `createToolCallingModel(toolName)` emits a single tool call so a tool
  `execute` closure runs. The entrypoint is built on the AI SDK's public
  `simulateReadableStream` and adds no runtime dependencies
  (`"dependencies": {}` stays; `ai` remains a peer).

### Migration notes

- Upgrade the runtime to Node.js `>=22` before adopting this release. There are
  no API changes: the `@AiStream`/`@AiAbortSignal`/`@AiContext` decorator and
  module surface is unchanged from `0.4.0`.
- If your tests hand-roll a v4 mock model the way the samples used to, you can
  replace it with `createMockLanguageModel` from `@nest-native/ai-sdk/testing`.

## 0.4.0 - 2026-06-30

Adopts the current major of the Vercel AI SDK (`ai ^7`) and `@ai-sdk/provider
^4`. This is a deliberate breaking peer change: consumers must be on `ai@^7`.
The package keeps `"dependencies": {}` and still depends on the AI SDK only
structurally (via the `pipe*ToResponse` contract), so the core
decorator/interceptor code is unchanged — the migration is in the peer range,
samples, and test fixtures.

### Changed (breaking)

- **Peer dependency: `ai` is now `^7`** (was `^6`). The AI SDK v7 provider
  specification moved the language-model interface from `v3` to `v4`, so the
  test fixtures and sample mock models were migrated to
  `specificationVersion: 'v4'` and the `LanguageModelV4` stream-part types. The
  stream-part *shape* is otherwise unchanged from v3 — the structured
  `finishReason: { unified, raw }` and the nested
  `usage.inputTokens`/`usage.outputTokens` token-detail objects carry over — so
  the only fixture edits are the interface-version bump.
  `@nest-native/ai-sdk`'s own runtime is unaffected.

### Migration notes

- Upgrade the AI SDK to `ai@^7` before upgrading `@nest-native/ai-sdk`. No
  application code change is required for the `@AiStream`, `@AiAbortSignal`, and
  `@AiContext` decorators themselves: the package consumes `streamText` /
  `streamObject` results through the same structural `pipe*ToResponse` contract,
  which v7 still provides.
- Custom UI message streams built with `createUIMessageStream` continue to use
  the AI SDK's standalone `pipeUIMessageStreamToResponse({ response, stream })`
  helper (see the `05-stream-ui` sample), unchanged from v6.

## 0.3.0 - 2026-06-22

Adopts the current major of the Vercel AI SDK (`ai ^6`) and `zod ^4`. This is a
deliberate breaking peer change: consumers must be on `ai@^6`. The package keeps
`"dependencies": {}` and still depends on the AI SDK only structurally (via the
`pipe*ToResponse` contract), so the core decorator/interceptor code is
unchanged — the migration is in the peer range, samples, and test fixtures.

### Changed (breaking)

- **Peer dependency: `ai` is now `^6`** (was `^5`). The AI SDK v6 provider
  specification moved from language-model interface `v2` to `v3`, so the test
  fixtures and sample mock models were migrated to the `v3` stream-part shape
  (`specificationVersion: 'v3'`, the structured `finishReason: { unified, raw }`,
  and the nested `usage.inputTokens`/`usage.outputTokens` token-detail objects).
  `@nest-native/ai-sdk`'s own runtime is unaffected.

### Migration notes

- `convertToModelMessages` is now async in v6 (returns `Promise<ModelMessage[]>`);
  `await` it before passing the result to `streamText`. The migration sample's
  handlers are now `async` accordingly.
- In v6 a `streamText` result's type references the AI SDK's internal `Output`
  type, which TypeScript cannot name when it is the inferred return type of a
  public controller method (`error TS4053`). Annotate such handlers with the
  package's exported structural `AiStreamResult` type (or
  `Promise<AiStreamResult>`) — the same contract `@AiStream` consumes. All
  samples now do this.
- `zod` is adopted at `^4` across the samples. The library has no `zod`
  dependency of its own; consumers bring their own schema library, and `ai@^6`
  already permits `zod@^3.25 || ^4`.

## 0.2.0 - 2026-06-15

Completes the v1 parameter-decorator surface with `@AiContext`, the last
primitive named in the public API.

### Added

- `@AiContext()` parameter decorator: injects a request-scoped
  `AiExecutionContext` — `{ request, response, signal }` — so an AI SDK tool's
  `execute` closure can reach the current request mid-stream. The closure runs
  inside the stream, after the handler returned, where ordinary Nest parameter
  decorators can no longer reach the request; capture the context in the handler
  and close over it to read request-scoped data (auth/headers a guard attached)
  and the client-disconnect signal. `request`/`response` come from the active
  adapter and `signal` reuses the package's memoized client-disconnect signal
  (the same one `@AiAbortSignal()` resolves), so it never wires a second
  `AbortController`. The context is memoized per request and works identically on
  Express and Fastify. Exported alongside the `AiExecutionContext` type and the
  unit-testable `aiContextFactory` / `resolveAiExecutionContext`.
- `sample/07-tool-context`: a focused sample whose `streamText` tool's `execute`
  reads the guard-attached `request.user` via `@AiContext` mid-stream. Its smoke
  test asserts a missing API key is a pre-stream `401` and that the tool output
  carries the authenticated user — on both Express and Fastify.

### Docs

- New `@AiContext` documentation page (sidebar + API reference), and the sample
  catalog/README gain `07-tool-context`. `CONTRIBUTING.md` and the `AiModule`
  JSDoc now describe the complete, released v1 surface (including `@AiContext`)
  rather than the bootstrap framing.

## 0.1.0 - 2026-06-14

First user-facing release. The full v1 surface — `@AiStream`, `@AiAbortSignal`,
and `AiModule` — ships on both Express and Fastify, with a documentation site.

### Added

- Documentation site (Docusaurus) under `website/`, mirroring the sibling
  `@nest-native` packages: getting-started, core-API (`@AiStream`,
  `@AiAbortSignal`, error mapping, stream formats, API reference), migration,
  production (patterns, security, adapters), sample catalog, and project-reference
  pages. CI gains a `docs-site` build job, the root `ci`/`security:audit` scripts
  gain `ci:docs`/`security:audit:docs`, and a `deploy-docs.yml` workflow publishes
  the site to GitHub Pages on pushes to `main`.
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
- `MIGRATION.md`: a step-by-step guide that ports every recipe in the official
  AI SDK NestJS cookbook (`ai-sdk.dev/cookbook/api-servers/nest`) — UI message
  stream, custom data parts, and text stream — from raw `@Res()` +
  `pipe*ToResponse` to `@AiStream`, with a checklist and a v4→v5 note. Linked
  from the root and package READMEs.
- `sample/06-migration`: a focused before/after sample mounting the cookbook's
  raw `@Res()` recipe (`/legacy/*`) next to its `@AiStream` migration
  (`/migrated/*`). Its smoke test asserts the streams are byte-identical on
  Express, that the migrated route validates input as a pre-stream HTTP `400`
  where the legacy recipe `500`s, and that the migrated recipes stream on Fastify
  where the Express-only `@Res()` recipe cannot.

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
