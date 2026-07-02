# GUIDELINES_NEST_AI_SDK.md

## Core Philosophy — This library MUST feel native in NestJS projects

Every decision must follow NestJS philosophy as `@Sse` and standard HTTP
handler decorators do, while preserving the Vercel AI SDK's streaming
semantics. The bar is: feel like a first-class NestJS streaming primitive,
replace the "raw `@Res()` + manual piping" pattern with something the Nest
enhancer pipeline respects, never hide the AI SDK behind a magic facade.

### 1. Overall Architecture Assumptions (never break these)

- First-class NestJS integration, not a thin wrapper around the Vercel AI
  SDK.
- Decorator-first, OOP, heavy use of NestJS DI.
- Mirror the DX of `@Sse` for streaming-aware HTTP handlers, while
  explicitly avoiding `@Sse`'s known bugs (`nestjs/nest#12670`: connection
  opens before the handler runs).
- Current stabilization support line:
  - Node.js `>=22` (required by `ai@7`)
  - NestJS `11.x`
  - `ai` (Vercel AI SDK) `^7` — track the current major; adopt new majors
    rather than pinning to an old one. Older majors are not supported; a
    major bump is a deliberate breaking peer change (see §10).
- Full NestJS enhancer pipeline integration is NON-NEGOTIABLE:
  - Guards reject BEFORE the stream opens (so errors are HTTP errors, not
    SSE frames).
  - Pipes validate inputs; pipes are not used on streaming outputs.
  - Interceptors can wrap pre-stream and post-stream behavior;
    response-transform-style interceptors are documented as incompatible
    with streaming.
  - Filters can map pre-stream exceptions to HTTP errors and in-stream
    exceptions to documented stream-error frames.
- Adapter-agnostic: Express and Fastify parity is required.
- Support both validation worlds for handler inputs:
  - `class-validator` + DTOs via `ValidationPipe`
  - Zod via `@Input()` or pipe

### 2. Public API Assumptions (this is what users will copy-paste)

- Module:
  - `AiModule.forRoot(options?)`
  - `AiModule.forRootAsync(options?)`
- Method decorator:
  - `@AiStream(options?)` — replaces `@Sse` for AI SDK streams. Handler
    returns an AI SDK stream result (e.g., from `streamText`, `streamObject`,
    `streamUI`)
- Parameter decorators:
  - `@AiContext()` — request-scoped context for tool execution
  - `@AiAbortSignal()` — client disconnect signal, plumbed to AI SDK calls

### 3. First-Version Scope Discipline

- v1 ships:
  - `@AiStream()` with full enhancer pipeline integration on Express + Fastify
  - `@AiAbortSignal()` plumbing with verified disconnect-cancels-AI-SDK-call
    behavior
  - Pre-stream vs in-stream error mapping (HTTP vs stream-error frame)
  - `streamText`, `streamObject`, `streamUI` (or v7 equivalents) supported
  - Showcase sample + at least four focused samples
- v1 does NOT ship:
  - Agent framework / tool execution helpers (use Mastra, LangGraph, etc.)
  - Model provider abstractions (the AI SDK already abstracts these)
  - Prompt management
  - Embedding / RAG helpers (defer indefinitely or to another package)
  - MCP (covered by `@rekog/mcp-nest`)
  - A general SSE primitive (out of scope; if Nest fixes `@Sse`, integrate
    at that point — do not pre-fix Nest's bug here)

### 4. Sample Folder Rules

- `sample/00-showcase` demonstrates:
  - `@AiStream()` with `streamText`, guards, an exception filter, and a pipe
    — all four working correctly
  - Pre-stream guard rejection returning 401/403 as HTTP (not SSE frame)
  - In-stream exception emitting a documented error frame
  - Express + Fastify mains
  - Client disconnect cancelling the AI SDK call (AbortController test)
- Focused samples: one per AI SDK stream type (`streamText`, `streamObject`,
  `streamUI`), adapter parity, validation, AbortSignal, migration from the
  official AI SDK cookbook recipe.
- Never simplify the showcase for brevity — richness proves the integration
  depth.

### 5. Implementation Rules

- `@AiStream` integrates with the adapter (Express response, Fastify reply)
  but the user does not need to interact with raw response objects.
- The decorator wraps the AI SDK's response helpers
  (`toUIMessageStreamResponse()`, `toDataStreamResponse()`, etc.), not raw
  `Readable` streams — preserve protocol fidelity.
- AbortSignal: when the client disconnects, propagate to the AI SDK call
  via its standard `signal` parameter. Test against real disconnect on
  Express AND Fastify.
- Pre-stream errors: thrown by handlers, guards, or pipes before the first
  byte. These must become HTTP error responses with the appropriate status.
  NEVER an SSE error frame.
- In-stream errors: thrown during stream production must become a
  documented error frame within the AI SDK protocol; never a
  partial-then-broken response.
- Interceptor compatibility: response-transform-style interceptors are
  incompatible with streaming. Document explicitly; do not auto-skip.
- Keep the package lean — `"dependencies": {}`. `ai`, `@nestjs/common`,
  `@nestjs/core` in `peerDependencies`.
- Never expose AI SDK internals unless the user opts in via advanced config.

### 6. Non-Negotiable Style & Patterns

- NestJS naming conventions (`@nestjs/common` style).
- Constructor injection.
- Always support global, module, and method-level enhancers.
- Tests must cover: pre-stream rejection, in-stream errors, AbortSignal
  cancellation, Express + Fastify parity, all three stream types.
- Documentation and README follow Nest-style clarity without claiming
  official Nest or Vercel AI SDK status.
- **Strictness scope.** The non-negotiables (100% coverage,
  cognitive-complexity ≤ 15, zero published runtime deps, isolated
  major-version review) govern the *core* published package
  (`packages/ai-sdk`). Non-core code — `sample/*`, the `website/`, and dev
  tooling — uses lighter rules: their dependency updates (including majors)
  may merge on green CI without the core's major-isolation ceremony.

### 7. When In Doubt

- Ask: "Would this feel natural alongside `@Sse` (with its bugs fixed) and
  the standard Nest HTTP handler shape, while honoring the AI SDK's
  streaming protocol?"
- If the answer is no, redesign.

### 8. Differentiation Strategy

- The only Nest-native primitive for AI SDK streaming — the official AI SDK
  cookbook uses raw `@Res()` + manual piping.
- Pre-stream guard semantics: HTTP errors, not SSE error frames. This is
  the headline differentiator.
- AbortSignal propagation is real and tested, not a documented gotcha.
- Express + Fastify parity is shipped, not assumed.

### 9. Security Review Requirements (MANDATORY)

- Every PR includes an explicit security pass.
- Supply-chain checks are NON-NEGOTIABLE:
  - Every dependency addition/update reviewed for legitimacy.
  - `packages/ai-sdk/package.json` must keep `"dependencies": {}`.
  - AI SDK is a fast-moving peer; review changelog at every bump.
  - Inspect lifecycle scripts on every dep change.
  - Flag unpinned Git/URL dependencies.
- **Audit scope.** The `security:audit` release gate audits the *published*
  surface — `npm audit --omit=dev --audit-level=high`. Since the package
  publishes `"dependencies": {}`, this is exactly what consumers install.
  Advisories confined to dev/peer/build tooling or the docs `website/` are
  tracked and patched via Dependabot but do not block releases — they cannot
  reach consumers. Patch them in their own PRs.
- Application security checks:
  - Auth bypass through `@AiStream` (pre-stream guard checks MUST run;
    verify in tests).
  - Prompt injection paths from request input into AI SDK calls (samples
    show safe input handling).
  - Secret leakage in streaming responses (API keys must never appear in
    user-visible output).
  - Cost-control patterns documented in samples (rate limiting,
    AbortSignal on disconnect, max-tokens guards).

### 10. Release Version Synchronization (MANDATORY)

- Version drift between `packages/ai-sdk` and `sample/*` is a release blocker.
- The AI SDK major is tracked, not pinned to a legacy version: the peer range
  follows the current major (`ai ^7`). When the AI SDK ships a new major, adopt
  it — bump the peer range, migrate the source/samples/fixtures to the new API,
  and release it as a breaking peer change — rather than holding an old major.
  Document the supported range and non-support of older majors prominently.
- When bumping `packages/ai-sdk/package.json`, update all
  `sample/*/package.json` entries for `"@nest-native/ai-sdk"` in the same change.
- Regenerate `package-lock.json`. Run `npm run release:check`. Run
  `npm run ci`.
- Post-publish: re-run full CI with samples pinned to the published version.

### 11. Cognitive Complexity Review

- When changes touch `packages/ai-sdk/**/*.ts`, run `npm run complexity:check`
  and `npm run complexity:report`.
- CI enforces SonarJS cognitive-complexity threshold of `15` per package
  source function.
- Do not reduce complexity by weakening enhancer integration, AbortSignal
  correctness, or test coverage.

### 12. Accumulated Project Decisions

(Empty at v0; grows as the project lands decisions worth preserving. Append
entries here when an architectural call repeats or is non-obvious. Each
entry should be one short paragraph with rationale.)
