# Sample 02 - AbortSignal Cancels the AI SDK Call on Disconnect

When a client disconnects mid-stream, you almost never want the model to keep
generating: the tokens go nowhere, but the provider keeps billing. `@AiStream`
solves this with a single parameter decorator.

`@AiAbortSignal()` injects an `AbortSignal` derived from the client's
connection. Forward it into your AI SDK call and a disconnect tears the upstream
model request down immediately:

```ts
@Post()
@AiStream()
chat(@Body() body: ChatDto, @AiAbortSignal() signal: AbortSignal) {
  return streamText({ model, prompt: body.prompt, abortSignal: signal });
}
```

That one line — `abortSignal: signal` — is the whole sample.

## What It Demonstrates

- **Disconnect cancels the model call.** The smoke test opens a stream with a
  client-side `AbortController`, reads the first bytes so it is genuinely
  mid-stream, then `controller.abort()`s. It asserts that the very signal
  forwarded into `streamText` becomes `aborted` — i.e. the AI SDK request is
  cancelled, which is what stops upstream billing.
- **Express and Fastify parity.** The same controller runs on both adapters and
  the disconnect propagates identically on each. The package derives the signal
  from the underlying Node response (Express directly; Fastify via `reply.raw`),
  and hands the response lifecycle to the AI SDK on Fastify via `reply.hijack()`
  so a disconnect never throws `ERR_HTTP_HEADERS_SENT`.
- **Inputs are still validated.** A Zod pipe rejects an empty prompt with HTTP
  400 before the stream ever opens.

Like every sample it streams from a deterministic, offline mock model that
records the abort signal it receives — no API keys, no real billing — so it is
safe to run in CI.

## Commands

```bash
# Boots Express AND Fastify, opens a stream on each, disconnects mid-stream,
# and asserts the model's abort signal fired on both.
npm run test --workspace nest-native-ai-sdk-abort-signal

# Run a single adapter manually:
npm run start --workspace nest-native-ai-sdk-abort-signal          # Express
npm run start:fastify --workspace nest-native-ai-sdk-abort-signal  # Fastify
```

## Try It

```bash
# Open a stream, then press Ctrl-C to disconnect. The server cancels the model
# call instead of continuing to generate (and bill) for a dead connection.
curl -N -X POST localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"prompt":"tell me a long story"}'
```
