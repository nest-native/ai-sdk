# 04 — streamObject

Serves the AI SDK's [`streamObject`](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-object)
through `@AiStream`, streaming a structured object as partial-JSON text deltas
on both Express and Fastify.

## What it shows

- A `@Post('recipe')` handler returns a `streamObject` result with a Zod
  `schema`. The AI SDK streams the object as a sequence of partial-JSON text
  deltas that its `useObject` hook accumulates into a progressively-completed,
  typed object.
- `StreamObjectResult` exposes only `pipeTextStreamToResponse` (there is no
  UI-message variant), so the route opts into `@AiStream({ format: 'text' })`.
  The package's writer forwards just `status`/`headers` for the text format —
  the text protocol has no error frame — so the contract stays faithful.
- The full Nest enhancer pipeline still runs ahead of the stream: an
  `ApiKeyGuard` and a `ZodValidationPipe` both reject *before* the first byte,
  as HTTP `403`/`400`. The stream type does not change the pre-stream error
  guarantee.

The model is a fully offline mock — no provider, no API keys — so the sample
runs in CI without secrets.

## Run it

```bash
# Express
npm run start --workspace nest-native-ai-sdk-stream-object

# Fastify
npm run start:fastify --workspace nest-native-ai-sdk-stream-object
```

```bash
curl -N -X POST http://localhost:3000/recipe \
  -H 'content-type: application/json' \
  -H 'x-api-key: secret' \
  -d '{"dish":"crepes"}'
```

## Test it

```bash
npm run test --workspace nest-native-ai-sdk-stream-object
```

The smoke test boots the app on Express and Fastify and asserts that a missing
key is `403`, an empty `dish` is `400`, and a valid request streams the object
across multiple chunks whose accumulated body parses to the complete recipe.
