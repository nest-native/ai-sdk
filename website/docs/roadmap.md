# Roadmap

`@nest-native/ai-sdk` is intentionally narrow. This page records what v1 ships,
what it deliberately does not, and how the project handles change.

## v1 Ships

- `@AiStream()` with full Nest enhancer pipeline integration on Express and
  Fastify.
- `@AiAbortSignal()` with verified disconnect-cancels-the-AI-SDK-call behavior.
- Pre-stream vs in-stream error mapping (HTTP errors vs documented stream error
  frames).
- `streamText`, `streamObject`, and the v5 generative-UI equivalent of `streamUI`
  (custom `data-*` parts via `createUIMessageStream`).
- A showcase sample plus focused samples (parity, abort, error mapping, object,
  UI, migration).
- A migration guide porting the official AI SDK NestJS cookbook recipe.

## v1 Does Not Ship

These are out of scope by design, not by omission:

- **Agent framework / tool execution helpers.** Use Mastra, LangGraph, etc.
- **Model provider abstractions.** The AI SDK already abstracts providers; this
  package does not re-abstract them.
- **Prompt management.**
- **Embedding / RAG helpers.** Defer indefinitely or to another package.
- **MCP.** Covered by `@rekog/mcp-nest`.
- **A general SSE primitive.** Out of scope. If Nest core fixes `@Sse`
  ([`nestjs/nest#12670`](https://github.com/nestjs/nest/issues/12670)), integrate
  at that point — the package does not pre-fix Nest's bug.

"We're already there, let's add tools" is a one-way trip into a much bigger
package. The project resists it.

## Known Risks

- **AI SDK breaking changes.** v5 → v6 reworked the provider specification
  (language-model interface `v2` → `v3`) and made `convertToModelMessages`
  async; future majors will also break. The package tracks the current major and
  adopts each new one — migrating source, samples, and fixtures — rather than
  holding a legacy major.
- **`@Sse` bug evolution.** If Nest fixes `#12670`, parts of the design may be
  re-evaluated at the corresponding Nest minor.
- **Provider-specific quirks leaking in.** The AI SDK normalizes most of this, but
  edge cases (Anthropic prompt caching, OpenAI tool-call semantics) leak. The
  package documents them; it does not abstract them.

## Beyond v1

There is no committed feature roadmap beyond keeping the current `0.x` surface
correct across NestJS minors and AI SDK majors. Anything new is weighed against the design
bar: *would it feel native alongside `@Sse` (with its bugs fixed) and the standard
Nest HTTP handler shape, while honoring the AI SDK's streaming protocol?* If not,
it is not added.
