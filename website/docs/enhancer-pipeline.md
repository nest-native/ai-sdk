# Enhancer Pipeline

The headline feature of `@AiStream` is that the full Nest enhancer pipeline runs
*before* the stream opens. This page describes how each enhancer composes with
streaming, and which ones are incompatible.

## Execution Order

`@AiStream` is implemented as a Nest interceptor applied to the handler. So the
ordinary Nest request lifecycle runs in full before any bytes hit the socket:

1. **Guards** run. A rejection short-circuits with an HTTP error — the stream
   never opens.
2. **Pipes** run on the handler's inputs. A validation failure is a pre-stream
   HTTP `400` — the stream never opens.
3. **Interceptors** run. They can stamp pre-stream headers, start timers, or wrap
   the call.
4. The **handler** runs and returns an AI SDK stream result.
5. `@AiStream` serializes that result to the adapter's response, applying the
   resolved status, headers, and in-stream error mapper.

Only at step 5 does the response start streaming. Everything before it is a
normal Nest request that can still fail as an HTTP error.

## Guards

Guards reject **before the stream opens**, so an auth failure is a real HTTP
`401`/`403`, never an SSE error frame. This is the project's headline
differentiator over `@Sse` (which opens the connection first). Apply guards
exactly as you would on any handler:

```ts
@Post()
@AiStream()
@UseGuards(ApiKeyGuard)
chat(@Body() body: ChatDto) {
  return streamText({ model, prompt: body.prompt });
}
```

## Pipes

Pipes validate **inputs only**. A `ValidationPipe` (class-validator) or a Zod
pipe rejects bad input as a pre-stream HTTP `400`:

```ts
@Post()
@AiStream()
chat(@Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest) {
  return streamText({ model, messages: convertToModelMessages(body.messages) });
}
```

A pipe on a streaming **output** is meaningless — there is no materialized
response body to transform — and is never applied. Both validation worlds are
supported: class-validator DTOs via `ValidationPipe`, and Zod via a custom pipe.

## Interceptors

Interceptors that act **before** the stream opens compose cleanly: logging,
header stamping, metrics, and timing all work.

Response-**transform** interceptors are a different story. A classic
`ResponseTransformInterceptor` that rewrites the final response body (for
example, wrapping it in `{ data: ... }`) is **incompatible** with streaming —
there is no single materialized body to rewrite. The package does **not**
auto-skip them; applying one to an `@AiStream` route is a mistake you must avoid.
Document this for your team and keep transform interceptors off streaming routes.

## Exception Filters

Exception filters map **pre-stream** exceptions to HTTP responses. A domain error
thrown by a guard, a pipe, or the handler *before the first byte* flows through
your filters and becomes an HTTP error with the right status.

Errors thrown **during** stream production are a separate path: the status and
headers are already on the wire, so they cannot become HTTP errors. They become
the AI SDK's documented in-stream error frame instead. See
[Error Mapping](error-mapping.md) for the full two-sided model.

## Summary

| Enhancer | With `@AiStream` |
| :--- | :--- |
| Guards | Run pre-stream; rejection is an HTTP error |
| Pipes | Validate inputs pre-stream; never applied to the output |
| Interceptors (pre-stream) | Run; stamp headers, time, log |
| Interceptors (response-transform) | Incompatible; not auto-skipped — keep off streaming routes |
| Exception filters | Map pre-stream exceptions to HTTP; in-stream errors become stream frames |

See [`sample/00-showcase`](samples/catalog.md) for all four enhancer types
composing with `@AiStream` in one controller.
