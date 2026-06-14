# 06 — Migration from the official cookbook

Ports the official AI SDK NestJS cookbook recipe —
[`ai-sdk.dev/cookbook/api-servers/nest`](https://ai-sdk.dev/cookbook/api-servers/nest),
which uses raw `@Res()` + `pipe*ToResponse` — to `@AiStream`, with the **before**
and **after** controllers living side by side so the difference is concrete and
testable. The full prose walkthrough is the repo-root
[`MIGRATION.md`](../../MIGRATION.md).

## What it shows

The cookbook recipe has three variants; all three are reproduced verbatim in
shape in [`legacy.controller.ts`](./src/chat/legacy.controller.ts) (the
**before**) and migrated in
[`migrated.controller.ts`](./src/chat/migrated.controller.ts) (the **after**):

| Cookbook recipe | Before (`@Res()`) | After (`@AiStream`) |
| :--- | :--- | :--- |
| UI message stream | `result.pipeUIMessageStreamToResponse(res)` | `return result` |
| Custom data part | `pipeUIMessageStreamToResponse({ stream, response })` | `return toUiMessageStreamResult(stream)` |
| Text stream | `result.pipeTextStreamToResponse(res)` | `return result` + `@AiStream({ format: 'text' })` |

The migration is **behaviour-preserving** on the happy path — the smoke test
asserts the `/legacy/*` and `/migrated/*` routes put byte-identical streams on
the wire — while fixing two things the raw `@Res()` recipe cannot do natively:

- **Input validation.** The migrated route runs a `ValidationPipe` that rejects a
  malformed body with a clean HTTP `400` *before* the stream opens. The legacy
  recipe has no Nest-native place for it, so the same body crashes the handler
  into an HTTP `500`.
- **Adapter parity.** The migrated recipes stream identically on Fastify; the
  legacy `@Res()` recipe is Express-only (it hands the AI SDK helper a Node
  response, but Fastify gives the handler a `FastifyReply`), so it fails on
  Fastify with a `500`.

The shared `ApiKeyGuard` returns HTTP `401` on both routes — guards run ahead of
the handler regardless of `@Res()` — so the migration does not regress auth. What
the migration buys is the rest of the enhancer pipeline (pipes, interceptors,
filters) and the response wiring (adapter, abort signal, headers, status, the
secret-safe in-stream `onError`), none of which you get for free with `@Res()`.

The model is a fully offline mock — no provider, no API keys — so the sample runs
in CI without secrets.

## Run it

```bash
# Express (both /legacy and /migrated routes)
npm run start --workspace nest-native-ai-sdk-migration

# Fastify (only /migrated routes stream; /legacy fails — that is the point)
npm run start:fastify --workspace nest-native-ai-sdk-migration
```

```bash
# The migrated recipe, byte-identical to the cookbook's output:
curl -N -X POST http://localhost:3000/migrated/chat \
  -H 'content-type: application/json' \
  -H 'x-api-key: secret' \
  -d '{"messages":[{"role":"user","parts":[{"type":"text","text":"ping"}]}]}'
```

## Test it

```bash
npm run test --workspace nest-native-ai-sdk-migration
```

The smoke test boots the app on Express and Fastify and asserts: the guard
rejects with `401` on both routes; each recipe's `/legacy` and `/migrated`
streams are identical on Express; the migrated route validates input as a `400`
while the legacy route 500s on the same body; and the migrated recipes stream on
Fastify while the legacy `@Res()` recipe does not.
