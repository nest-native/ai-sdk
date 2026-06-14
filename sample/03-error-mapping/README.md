# Sample 03 - Error Mapping: Pre-stream vs In-stream

`@AiStream` has a two-sided error model, and getting it right is the whole point
of replacing the raw `@Res()` cookbook recipe:

- **Pre-stream errors** — thrown by a guard, a pipe, or the handler *before* it
  returns a stream — flow through the Nest enhancer pipeline and become normal
  HTTP errors. The stream is never opened, so the client gets a clean 401 / 403 /
  400 / 429, exactly like any other route.
- **In-stream errors** — thrown *during* stream production, after the first byte
  — can no longer be HTTP errors: the status and headers are already on the wire.
  Instead the AI SDK emits a **documented error frame** inside the stream
  protocol, never a partial-then-broken response.

```ts
// Pre-stream: a guard/pipe/handler error is an HTTP error.
@Post('default')
@AiStream()
@UseGuards(ApiKeyGuard)               // → HTTP 403 if it rejects
default(@Body(new ZodValidationPipe(schema)) body: ChatRequest) {
  return streamText({ model, prompt: body.prompt });
}

// In-stream: map the error frame's message with `onError`.
@Post('mapped')
@AiStream({ onError: () => 'The model is temporarily unavailable.' })
mapped(@Body(new ZodValidationPipe(schema)) body: ChatRequest) {
  return streamText({ model, prompt: body.prompt });
}
```

## What It Demonstrates

- **Pre-stream guard rejection → HTTP 403.** No `x-api-key` header means the
  guard rejects before `@AiStream` opens the stream — a plain HTTP error, never a
  stream frame.
- **Pre-stream validation → HTTP 400.** An empty prompt fails the Zod pipe before
  the stream opens.
- **Pre-stream handler exception → HTTP 429.** The `quota` route throws before
  returning a stream, so an exception filter maps it to HTTP 429.
- **In-stream error, default mapping → safe frame.** The `default` route's model
  fails mid-stream. The status is already 200, so the failure becomes a
  documented error frame whose message is the AI SDK's secret-safe default
  (`An error occurred.`) — the raw provider error is **hidden**, so credentials
  can never leak.
- **In-stream error, custom mapping → vetted frame.** The `mapped` route supplies
  `onError` to rewrite the frame's message to a stable, safe string. (Module-wide
  defaults are also supported via `AiModule.forRoot({ onError })`, with the
  method-level mapper winning.)
- **Happy path still clean.** A successful stream carries no error frame even with
  a mapper configured.

> The `text` format has no error frame — `pipeTextStreamToResponse` drops
> non-text events — so `onError` is ignored for `format: 'text'`. Use the default
> `ui-message` format when you need in-stream error reporting.

Every route runs on both Express and Fastify and streams from a deterministic,
offline mock model — no API keys, no real billing — so it is safe to run in CI.

## Commands

```bash
# Boots Express AND Fastify and asserts every error path on each.
npm run test --workspace nest-native-ai-sdk-error-mapping

# Run a single adapter manually:
npm run start --workspace nest-native-ai-sdk-error-mapping          # Express
npm run start:fastify --workspace nest-native-ai-sdk-error-mapping  # Fastify
```

## Try It

```bash
# Pre-stream guard rejection → HTTP 403 (no API key).
curl -i -X POST localhost:3000/chat/default \
  -H 'content-type: application/json' \
  -d '{"prompt":"hello"}'

# In-stream failure → 200 with a documented error frame; the raw error is hidden.
curl -N -X POST localhost:3000/chat/default \
  -H 'content-type: application/json' -H 'x-api-key: secret' \
  -d '{"prompt":"hello"}'

# In-stream failure with a custom mapper → a vetted error message in the frame.
curl -N -X POST localhost:3000/chat/mapped \
  -H 'content-type: application/json' -H 'x-api-key: secret' \
  -d '{"prompt":"hello"}'
```
