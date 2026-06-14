# Sample 01 - Express and Fastify Parity

`@AiStream` is adapter-agnostic: the package writes to the underlying Node
`ServerResponse` (Express exposes it directly; Fastify exposes it via
`reply.raw`), so the **same** controller streams correctly on both adapters,
with the full Nest enhancer pipeline behaving identically.

This focused sample mounts one `AppModule` — a single chat controller wrapped by
a guard, a Zod pipe, and an exception filter — on **both** an Express app
(`main.ts`) and a Fastify app (`main-fastify.ts`). The only line that differs
between the two entry points is the `FastifyAdapter` passed to
`NestFactory.create`.

## What It Demonstrates

- One controller, two adapters: Express and Fastify with zero adapter-specific
  handler code.
- Parity of every enhancer across adapters:
  - **Guard** (`ApiKeyGuard`) — pre-stream rejection returns HTTP 401 on both,
    never an SSE error frame.
  - **Pipe** (`ZodValidationPipe`) — input validation returns HTTP 400 on both,
    before the stream opens.
  - **Exception filter** (`QuotaExceededFilter`) — maps a pre-stream domain
    error to HTTP 429 on both.
- Parity of the stream payload itself: the smoke test boots both adapters and
  asserts the UI message stream and text stream bodies are identical.

Like the showcase, the sample streams from a deterministic mock model — no API
keys, no billing — so it is safe to run in CI.

## Commands

```bash
# Boots Express AND Fastify, runs the full assertion suite against each,
# then asserts the streamed bodies match across adapters.
npm run test --workspace nest-native-ai-sdk-fastify-parity

# Run a single adapter manually:
npm run start --workspace nest-native-ai-sdk-fastify-parity          # Express
npm run start:fastify --workspace nest-native-ai-sdk-fastify-parity  # Fastify
```

## Try It

```bash
# 401 — guard rejects before the stream opens (same on either adapter)
curl -i -X POST localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"prompt":"hello"}'

# 200 — UI message stream
curl -N -X POST localhost:3000/chat \
  -H 'content-type: application/json' \
  -H 'x-api-key: parity-secret' \
  -d '{"prompt":"hello"}'
```
