# Sample Catalog

Every sample is a self-contained workspace under
[`sample/`](https://github.com/nest-native/ai-sdk/tree/main/sample). None call a
real model provider — all use a mock model, so no API keys are needed.

| Sample | AI SDK call | What it proves |
| :--- | :--- | :--- |
| `00-showcase` | `streamText` (mock) | Guard, Zod pipe, interceptor, and exception filter all composing around `@AiStream` on Express |
| `01-fastify-parity` | `streamText` (mock) | One controller on Express and Fastify; streamed payloads match byte-for-byte |
| `02-abort-signal` | `streamText` + `@AiAbortSignal` (mock) | Disconnect mid-stream cancels the AI SDK call on both adapters |
| `03-error-mapping` | `streamText` (mock) | Pre-stream HTTP errors vs in-stream `onError` frame mapping on both adapters |
| `04-stream-object` | `streamObject` (mock) | Structured object streamed as partial-JSON text deltas via `format: 'text'` on both adapters |
| `05-stream-ui` | `createUIMessageStream` (mock) | Custom `data-*` UI parts — the v5 generative-UI equivalent of `streamUI` — on both adapters |
| `06-migration` | `streamText` / `createUIMessageStream` (mock) | Cookbook `@Res()` vs `@AiStream` before/after: byte-identical streams, plus pre-stream validation and Fastify parity the `@Res()` recipe lacks |

## `00-showcase`

The full integration baseline. One controller wires all four enhancer types
around `@AiStream`: an API-key guard (pre-stream `401`/`403`), a Zod validation
pipe (pre-stream `400`), a request-audit interceptor, and an exception filter.
Its smoke test asserts each enhancer behaves correctly and the stream flows.

Never simplified for brevity — its richness is the proof of integration depth.

## `01-fastify-parity`

Mounts one controller (guard + Zod pipe + exception filter) on both an Express
app and a Fastify app. The smoke test boots both adapters and asserts the
streamed payloads are identical. See [Adapters](../adapters.md).

## `02-abort-signal`

Opens a stream with a client-side `AbortController`, disconnects mid-stream, and
asserts the AI SDK model call is cancelled — on both Express and Fastify. See
[@AiAbortSignal](../abort-signal.md).

## `03-error-mapping`

Demonstrates the two-sided error model: pre-stream errors (guard/pipe/handler)
become HTTP errors, while in-stream failures become documented stream error
frames. The default `onError` hides the raw error; a custom mapper rewrites it.
Verified on both adapters. See [Error Mapping](../error-mapping.md).

## `04-stream-object`

Serves a `streamObject` result through `@AiStream({ format: 'text' })`, streaming
a structured object as partial-JSON text deltas on both adapters. See
[Stream Formats](../stream-formats.md).

## `05-stream-ui`

The v5 generative-UI replacement for the removed RSC `streamUI`: a UI message
stream with a custom `data-*` part built via `createUIMessageStream`, served
through `@AiStream` on both adapters using a small app-owned wrapper. See
[Stream Formats](../stream-formats.md).

## `06-migration`

A before/after port of the official AI SDK NestJS cookbook recipe. The
`/legacy/*` routes are the raw `@Res()` + `pipe*ToResponse` recipe; the
`/migrated/*` routes are the `@AiStream` version. The smoke test asserts the
streams are byte-identical, that the migrated route validates input as a
pre-stream `400` where the legacy recipe `500`s, and that the migrated recipes
stream on Fastify where the Express-only `@Res()` recipe cannot. See the
[Migration Guide](../migration.md).
