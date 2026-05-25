# nest-ai-native — Implementation Brief

> Single source of truth for implementing `nest-native/nest-ai-native`.
> Read this end-to-end before writing code. It is written for a fresh
> session that has no other context.

**Project type:** New package.
**Repository:** https://github.com/nest-native/nest-ai-native
**Org:** https://github.com/nest-native

---

## 1. Read these first

This package's constitution is `.briefing/AI_CODING_GUIDELINES.md` at the repo
root. Read it end-to-end before writing code. It is the SOLE governing
document for this package — no other guideline files apply.

This brief specifies WHAT to build and ON WHAT SCHEDULE. The constitution
specifies HOW. If they conflict on a general nest-native principle,
**the constitution wins**.

If you discover an inconsistency between this brief and the constitution,
or between either and the implementation reality (e.g., the Vercel AI SDK
v5 streaming API differs from what we assumed), you may update the
constitution as part of your PR:

- Update in a focused commit on the current branch (alongside the code
  that exposed the inconsistency).
- The PR body MUST include a "Guideline Updates" section quoting the
  before/after of every changed section.
- Do not weaken the Security, Release Sync, or Cognitive Complexity
  sections without explicit operator instruction here in the brief.
- Do not delete sections; rewrite or add a "Superseded" note.
- If a change would require revisiting a previously-merged milestone,
  STOP and flag — do not silently invalidate prior work.

## 2. Mission

A decorator-first NestJS primitive for streaming responses from the
Vercel AI SDK that **preserves the full Nest enhancer pipeline**. Replace
the "raw `@Res()` + manual piping" pattern the official AI SDK cookbook
recommends with a real Nest-native abstraction.

## 3. Community pain (the gap)

The Vercel AI SDK is the default streaming-LLM client for TypeScript.
NestJS integration today is missing primitives:

- The "official" cookbook (https://ai-sdk.dev/cookbook/api-servers/nest)
  uses raw `@Res()` + `pipeUIMessageStreamToResponse()`. This bypasses
  interceptors, guards, and exception filters.
- `@Sse` is structurally broken for this use case: it opens the connection
  *before* the handler runs (`nestjs/nest#12670`), so pre-flight auth
  errors become SSE error events instead of HTTP errors.
- Multiple "perfect NestJS support" feature requests remain open in the AI
  SDK repo (`vercel/ai#640`, `#221`).
- The MCP space has `@rekog/mcp-nest` (~394k monthly downloads) — appetite
  for AI-adjacent Nest packages is real. AI SDK streaming itself remains
  uncovered.

Evidence:
- https://github.com/vercel/ai/issues/640
- https://ai-sdk.dev/cookbook/api-servers/nest
- https://github.com/nestjs/nest/issues/12670
- https://github.com/vercel/ai/issues/221

## 4. Non-goals

- **Re-implementing the AI SDK.** Wrap it; do not replace it.
- **A general SSE primitive.** Out of scope. If Nest core ships a fix for
  `#12670`, integrate; do not pre-fix Nest's bug here.
- **Model provider opinions.** OpenAI / Anthropic / Google — the AI SDK
  abstracts these. Do not re-abstract them.
- **Agent framework / tool execution.** Covered by Mastra, LangGraph,
  etc. This package is *streaming integration*, not orchestration.
- **MCP.** `@rekog/mcp-nest` covers that surface.
- **Embedding / RAG helpers.** Defer indefinitely or to another package.

## 5. Tech stack and versions

| Item | Choice |
| --- | --- |
| Node | `>=20` |
| NestJS | `11.x` |
| TypeScript | `^6` |
| `ai` (Vercel AI SDK) | `^5` (pin major, allow minor) |
| HTTP adapter | both Express and Fastify |
| Validation | both Zod and class-validator |
| Test runner | `node:test` + `c8` |
| Lint | ESLint 10 + SonarJS, complexity 15 |
| Package manager | `npm@11` |

Published package keeps `"dependencies": {}`. `ai` and Nest packages live
in `peerDependencies`.

## 6. Repo layout

Mirror the existing nest-native package layout exactly. Use
`nest-native/nest-trpc-native` as the concrete template.

## 7. Public API surface (proposed — confirm via samples first)

Method decorator:
- `@AiStream(options?)` — replaces `@Sse` for AI SDK streams. Handler
  returns an AI SDK stream result (e.g. `streamText`, `streamObject`);
  the decorator wires the response correctly while preserving the
  enhancer pipeline.

Parameter decorators:
- `@AiContext()` — request-scoped context for tool execution
- `@AiAbortSignal()` — the client's disconnect signal, plumbed through to
  the AI SDK call

Module:
- `AiModule.forRoot(options?)` — global config (default headers, error
  mapping, telemetry hooks)
- `AiModule.forRootAsync(options?)`

What this package explicitly does **not** define: model providers, prompt
templates, tool registries, agent state. Those live in user code or other
packages.

## 8. v1 scope discipline

**Ships:** `@AiStream()` with full enhancer pipeline integration;
`@AiAbortSignal()`; Express + Fastify adapter parity; `streamText`,
`streamObject`, `streamUI` (or v5 equivalents) all supported; error
mapping (thrown before stream → HTTP error; thrown during stream → stream
error frame); showcase sample + four+ focused samples.

**Does NOT ship:** agent framework, tool execution helpers, provider
abstractions, prompt management, embedding/RAG helpers.

## 9. Design questions to settle in v1

1. **Pre-stream error semantics.** Errors thrown by guards or before the
   first byte must be HTTP errors, not SSE frames. How is that enforced?
2. **AbortSignal plumbing.** Client disconnect mid-stream must cancel the
   underlying AI SDK request (to stop billing). Test against real
   disconnect.
3. **Interceptor compatibility.** Interceptors that transform the final
   response (e.g. classic `ResponseTransformInterceptor`) do not fit a
   streaming model. Document explicitly; do not auto-skip.
4. **Pipe behavior.** `ValidationPipe` on streaming responses is
   meaningless. Validate inputs only.
5. **AI SDK protocol drift.** v4 → v5 reworked the stream protocol. Pin
   v5 explicitly; document the v4 incompatibility.

## 10. Quality gates

Same as the existing two packages. See `.briefing/AI_CODING_GUIDELINES.md` §9–§11.

## 11. Milestones

1. **Bootstrap.** Repo skeleton, empty package, CI green. Tag
   `v0.0.1-scaffold`. (`.briefing/AI_CODING_GUIDELINES.md` is already at the repo
   root from the initial commit; no need to create it.)
2. `@AiStream` skeleton on Express. Showcase sample with `streamText`,
   guards, and an exception filter — all four working correctly.
3. Fastify parity sample.
4. `@AiAbortSignal` + real disconnect test (use `AbortController` in the
   sample client).
5. Error mapping: pre-stream vs in-stream. Tests for both paths.
6. `streamObject` + `streamUI` samples.
7. Migration guide from "raw `@Res()` + `pipeUIMessageStreamToResponse`".
   Port the official cookbook recipe to use this package.
8. Documentation site (Docusaurus, mirror existing). Release v0.1.

## 12. First-session checklist

1. Read `.briefing/AI_CODING_GUIDELINES.md` in full (the constitution).
2. Read this brief end-to-end.
3. Read https://ai-sdk.dev/docs — at least the streaming sections.
4. Inspect `nestjs/nest#12670` for the latest community workaround for
   `@Sse`. Do **not** depend on it being fixed.
5. Use `nest-native/nest-trpc-native` as the concrete template.
6. Bootstrap commit. Push. CI green.
7. Stop at `v0.0.1-scaffold` and hand back.

## 13. Definition of done for v1

- The cookbook recipe is portable: every flow shown in
  https://ai-sdk.dev/cookbook/api-servers/nest works via `@AiStream`
  instead of raw `@Res()`.
- Pre-stream guard rejection returns 401/403 as HTTP error, never as SSE
  frame.
- Client disconnect cancels the AI SDK request (verified by AbortSignal
  test).
- Express and Fastify parity confirmed by twin samples.
- `npm run ci` green on Node 20 and 22.

## 14. Honest risks

- **AI SDK breaking changes.** v4 → v5 was substantial. Future majors
  will also break the stream protocol. Pin majors, document upgrade
  contracts, budget for re-issue work each major.
- **`@Sse` bug evolution.** If Nest fixes `#12670`, parts of this
  package's design may become obsolete. Re-evaluate at each Nest minor.
- **Scope creep into agents.** "We're already there, let's add tools" is
  a one-way trip into a much bigger package. Resist.
- **Provider-specific quirks leaking in.** The AI SDK normalizes most of
  this, but edge cases (Anthropic prompt caching, OpenAI tool-call
  semantics) leak. Document, do not abstract.

## 15. References

- Vercel AI SDK: https://ai-sdk.dev
- AI SDK NestJS cookbook (the workaround we are replacing):
  https://ai-sdk.dev/cookbook/api-servers/nest
- `nestjs/nest#12670` (the `@Sse` bug we work around):
  https://github.com/nestjs/nest/issues/12670
- This project's constitution: `.briefing/AI_CODING_GUIDELINES.md`.
- Existing nest-native packages as concrete templates:
  - https://github.com/nest-native/nest-drizzle-native
  - https://github.com/nest-native/nest-trpc-native
