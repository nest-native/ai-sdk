# 05 — streamUI (v5 generative-UI equivalent)

The AI SDK's old `streamUI` lived in `ai/rsc` and streamed React Server
Component nodes. **v5 removed it** (`ai/rsc` is no longer part of the `ai`
package). The supported replacement is the **UI message stream with custom data
parts**: the server writes typed `data-*` parts and the client renders each one
with its own component. This sample serves that v5 mechanism through `@AiStream`
on both Express and Fastify.

## What it shows

- A `@Post('weather')` handler builds a UI message stream with
  [`createUIMessageStream`](https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream),
  writing both text deltas and a custom `data-weather` part. On the client,
  `useChat` exposes that part via `message.parts` so a `<WeatherCard />`
  renders it — the v5 way to "stream UI".
- `createUIMessageStream` returns a bare `ReadableStream`, which `@AiStream`
  does not serialize directly. The handler adapts it with a tiny local wrapper
  (`toUiMessageStreamResult`) that delegates to the AI SDK's standalone
  `pipeUIMessageStreamToResponse({ response, stream })`. The wrapper lives in
  user code — the package keeps `"dependencies": {}` and never imports AI SDK
  internals.
- The full Nest enhancer pipeline still runs ahead of the stream: an
  `ApiKeyGuard` and a `ZodValidationPipe` both reject *before* the first byte,
  as HTTP `403`/`400`.

The forecast is deterministic and fully offline — no provider, no API keys — so
the sample runs in CI without secrets.

## Run it

```bash
# Express
npm run start --workspace nest-native-ai-sdk-stream-ui

# Fastify
npm run start:fastify --workspace nest-native-ai-sdk-stream-ui
```

```bash
curl -N -X POST http://localhost:3000/weather \
  -H 'content-type: application/json' \
  -H 'x-api-key: secret' \
  -d '{"city":"Lisbon"}'
```

## Test it

```bash
npm run test --workspace nest-native-ai-sdk-stream-ui
```

The smoke test boots the app on Express and Fastify and asserts that a missing
key is `403`, an empty `city` is `400`, and a valid request streams both a text
delta mentioning the city and a `data-weather` part carrying the full forecast.
