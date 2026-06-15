# Samples

The sample tree follows the same shape as the main quality strategy:

- `00-showcase`: the full integration baseline.
- `01-fastify-parity`: one controller on both Express and Fastify, proving
  adapter parity for `@AiStream` and the enhancer pipeline.
- `02-abort-signal`: `@AiAbortSignal()` forwarding the client-disconnect signal
  into the AI SDK call, with a smoke test that disconnects mid-stream and
  asserts the model call is cancelled on both adapters.
- `03-error-mapping`: the two-sided error model — pre-stream errors
  (guard/pipe/handler) become HTTP errors, while in-stream failures become
  documented stream error frames, with `onError` mapping (default hides the raw
  error; a custom mapper rewrites it) verified on both adapters.
- `04-stream-object`: `streamObject` served through `@AiStream({ format:
  'text' })`, streaming a structured object as partial-JSON text deltas on both
  adapters.
- `05-stream-ui`: the v5 generative-UI equivalent of the removed RSC
  `streamUI` — a UI message stream with a custom `data-*` part built via
  `createUIMessageStream` and served through `@AiStream` on both adapters.
- `06-migration`: a before/after port of the official AI SDK NestJS cookbook
  recipe — the raw `@Res()` + `pipe*ToResponse` controller (`/legacy/*`) next to
  its `@AiStream` migration (`/migrated/*`) — proving the streams are
  byte-identical while the migrated route gains pre-stream input validation and
  Fastify parity the `@Res()` recipe lacks. See the repo-root `MIGRATION.md`.
- `07-tool-context`: `@AiContext()` giving an AI SDK tool's `execute` closure
  request-scoped access — a guard attaches `request.user` pre-stream and the tool
  reads it back mid-stream through the captured context, on both adapters.

## Commands

```bash
npm run ci:sample
npm run showcase
npm run sample:focused
npm run test --workspace nest-native-ai-sdk-showcase
```

`npm run showcase` runs the `00-showcase` workspace when it is present.
`npm run sample:focused` discovers focused samples from `sample/*/package.json`
and runs them in folder order. `npm run ci:sample` runs both.
