# Why Native

The official AI SDK NestJS recipe
([`ai-sdk.dev/cookbook/api-servers/nest`](https://ai-sdk.dev/cookbook/api-servers/nest))
streams by taking over the response with `@Res()` and calling the AI SDK's
`pipe*ToResponse` helpers by hand. That works, but it sits **outside** the Nest
enhancer pipeline's response handling. This page explains the gap and how a
Nest-native primitive closes it.

## The Problem With Raw `@Res()`

When a handler injects `@Res()`, Nest steps back: the handler owns the socket.
That has consequences:

- **Interceptors and exception filters can no longer shape the response.** Once
  the handler is piping bytes, there is no Nest-controlled response object left
  for them to act on.
- **The recipe is Express-only.** It imports `express`'s `Response` type and
  hands it straight to the AI SDK helper. On Fastify the handler receives a
  `FastifyReply`, and the helper fails.
- **Every cross-cutting concern is hand-wired per route.** Headers, status, the
  abort signal, and a secret-safe error frame all become per-handler
  boilerplate.

## The Problem With `@Sse`

NestJS's `@Sse` is the obvious alternative, but it is structurally wrong for this
use case. It opens the SSE connection *before* the handler body runs
([`nestjs/nest#12670`](https://github.com/nestjs/nest/issues/12670)). So a guard
or pipe rejection that should be an HTTP `401`/`403`/`400` instead arrives as an
SSE error *event* on an already-`200` connection. Clients expecting an HTTP error
get a streamed one.

This package does **not** try to fix `@Sse`. If Nest core ships a fix for
`#12670`, integrate with it then. Until then, `@AiStream` is the streaming-aware
handler decorator that keeps pre-flight errors as HTTP errors.

## What `@AiStream` Restores

`@AiStream` runs as a Nest interceptor, so the full enhancer pipeline executes
*before* the stream opens:

| Concern | Raw `@Res()` | `@AiStream` |
| :--- | :--- | :--- |
| Response wiring | `@Res() res` + `result.pipe*ToResponse(res)` | `return result` |
| Guards (pre-flight auth) | HTTP error | HTTP error |
| Pipes / input validation | No Nest-native place | Pre-stream HTTP `400` |
| Interceptors / filters | Bypassed | Run before the stream opens |
| Express | yes | yes |
| Fastify | no | yes |
| Client abort signal | Plumb by hand | `@AiAbortSignal()` |
| Headers / status | Set on `res` by hand | `@AiStream({ headers, status })` |
| In-stream error frame | Pass `onError` per helper | `@AiStream({ onError })` / module default |

## The Design Bar

Every decision follows the bar set in the project constitution: *would this feel
natural alongside `@Sse` (with its bugs fixed) and the standard Nest HTTP handler
shape, while honoring the AI SDK's streaming protocol?* If the answer is no, the
feature is redesigned. The package never hides the AI SDK behind a magic facade —
the handler still returns a real AI SDK stream result, and the wire protocol is
exactly what the AI SDK produces.

Continue with [Quick Start](quick-start.md), or read how the pipeline composes in
[Enhancer Pipeline](enhancer-pipeline.md).
