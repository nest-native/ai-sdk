# Introduction

`@nest-native/ai-sdk` is a NestJS integration for streaming responses from the
[Vercel AI SDK](https://ai-sdk.dev). It is a decorator-first, Nest-native
primitive that replaces the "raw `@Res()` + manual piping" pattern the official
AI SDK cookbook recommends — while keeping the **full Nest enhancer pipeline**
(guards, pipes, interceptors, filters) intact.

It is the only Nest-native primitive aimed at AI SDK streaming. It wraps the AI
SDK's response helpers; it does not re-implement or hide the AI SDK.

## What It Owns

This package supplies the Nest-facing integration layer for AI SDK streaming:

- `AiModule.forRoot()` and `AiModule.forRootAsync()` for global configuration
  (default headers, default in-stream error mapping).
- `@AiStream()` to turn a Nest HTTP handler into an AI SDK streaming endpoint.
- `@AiAbortSignal()` to inject the client-disconnect signal so a disconnect
  cancels the upstream model request.

## What It Does Not Own

The package deliberately stops at streaming integration. Your application (or
another package) still owns:

- Model providers (OpenAI, Anthropic, Google) — the AI SDK already abstracts
  these.
- Prompt templates and prompt management.
- Tool registries, agent state, and orchestration (use Mastra, LangGraph, etc.).
- Embedding / RAG helpers.
- MCP (covered by `@rekog/mcp-nest`).

See [v1 scope discipline](roadmap.md) for the full boundary.

## Why Not `@Sse`?

NestJS ships `@Sse`, but it is structurally broken for AI SDK streaming: it opens
the connection *before* the handler runs
([`nestjs/nest#12670`](https://github.com/nestjs/nest/issues/12670)), so a
pre-flight auth error becomes an SSE error *event* instead of an HTTP error. This
package mirrors the DX of `@Sse` while avoiding that bug: guards reject before
the stream opens, so the response is a real HTTP `401`/`403`. See
[Why Native](why-native.md) for the full argument.

## When To Use It

Use this package when a Nest application needs to stream AI SDK results and you
want:

- Pre-stream guard rejection to be a real HTTP error, not a stream frame.
- A client disconnect to cancel the AI SDK call (and stop billing).
- The same handler to work on Express and Fastify.
- Pipes, interceptors, and exception filters to keep working around the stream.

For the design tradeoffs, see [Why Native](why-native.md). For the first runnable
setup, continue with [Quick Start](quick-start.md).
