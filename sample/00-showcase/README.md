# Sample 00 - Full Showcase

The full integration baseline for `@nest-native/ai-sdk`. It proves that
`@AiStream` preserves the entire Nest enhancer pipeline while streaming AI SDK
responses — the thing the official `@Res()` cookbook recipe cannot do.

To keep the sample free to run in CI (no API keys, no billing), it streams from
a deterministic mock language model. Swap `createMockModel(...)` for a real
provider model (e.g. `openai('gpt-4o')`) in your own app; `@AiStream` does not
care which model produced the result.

## What It Demonstrates

- `AiModule.forRoot()` with default streaming headers
- `@AiStream()` over a handler that returns a `streamText` result
- The default UI message stream format (`useChat` compatible) and the `text`
  format on a second route
- The four Nest enhancers composing with `@AiStream`, all on Express:
  - **Guard** (`ApiKeyGuard`) — pre-stream rejection returns HTTP 401, never an
    SSE error frame
  - **Pipe** (`ZodValidationPipe`) — input validation returns HTTP 400 before
    the stream opens
  - **Interceptor** (`RequestAuditInterceptor`) — stamps a header pre-stream
  - **Exception filter** (`RateLimitExceededFilter`) — maps a pre-stream domain
    error to HTTP 429
- A smoke test that asserts each of those behaviors against a real Express
  server

## Commands

```bash
npm run test --workspace nest-native-ai-sdk-showcase
npm run start --workspace nest-native-ai-sdk-showcase
```

## Try It

```bash
# 401 — guard rejects before the stream opens
curl -i -X POST localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"prompt":"hello"}'

# 200 — UI message stream
curl -N -X POST localhost:3000/chat \
  -H 'content-type: application/json' \
  -H 'x-api-key: showcase-secret' \
  -d '{"prompt":"hello"}'
```
