# Migration guide: from raw `@Res()` piping to `@AiStream`

The official AI SDK NestJS recipe —
[`ai-sdk.dev/cookbook/api-servers/nest`](https://ai-sdk.dev/cookbook/api-servers/nest)
— streams by taking over the response with `@Res()` and calling the AI SDK's
`pipe*ToResponse` helpers by hand. That works, but it sits **outside** the Nest
enhancer pipeline's response handling: the handler owns the socket, so pipes,
interceptors, and exception filters can no longer shape the response, the recipe
is Express-only, and you must remember to plumb the abort signal, headers,
status, and a secret-safe error frame on every route.

`@AiStream` replaces all of that with a single `return`. This guide ports every
recipe in the cookbook one-for-one. A runnable before/after of everything below
lives in [`sample/06-migration`](sample/06-migration/README.md) — the
`/legacy/*` routes are the cookbook recipe, the `/migrated/*` routes are the
`@AiStream` version, and its smoke test asserts the streams are byte-identical.

## TL;DR

| Concern | Cookbook (`@Res()`) | `@AiStream` |
| :--- | :--- | :--- |
| Response wiring | `@Res() res` + `result.pipe*ToResponse(res)` | `return result` |
| Guards | Run (a rejection is an HTTP error) | Run (a rejection is an HTTP error) |
| Pipes / input validation | No Nest-native place; bad input crashes the handler | `ValidationPipe` rejects pre-stream as HTTP `400` |
| Interceptors / filters | Bypassed — handler owns the response | Run before the stream opens |
| Express | ✅ | ✅ |
| Fastify | ❌ recipe types `express.Response` | ✅ same handler |
| Client abort signal | Plumb by hand | `@AiAbortSignal()` |
| Headers / status | Set on `res` by hand | `@AiStream({ headers, status })` |
| In-stream error frame | Pass `onError` by hand to each helper | `@AiStream({ onError })` / `AiModule.forRoot({ onError })` |

## 0. One-time setup

Register `AiModule` once. The cookbook needs no module because the handler owns
the response; `@AiStream` reads its defaults (headers, error mapping) from here.

```ts
import { Module } from '@nestjs/common';
import { AiModule } from '@nest-native/ai-sdk';

@Module({
  imports: [AiModule.forRoot()], // or .forRootAsync({ useFactory, inject })
})
export class AppModule {}
```

## 1. UI message stream

This is the cookbook's primary recipe — the format `@ai-sdk/react`'s `useChat`
consumes.

**Before** ([cookbook](https://ai-sdk.dev/cookbook/api-servers/nest)):

```ts
import { Controller, Post, Res } from '@nestjs/common';
import { streamText } from 'ai';
import { Response } from 'express';

@Controller()
export class AppController {
  @Post('/')
  async root(@Res() res: Response) {
    const result = streamText({
      model: 'openai/gpt-4o',
      prompt: 'Invent a new holiday and describe its traditions.',
    });

    result.pipeUIMessageStreamToResponse(res);
  }
}
```

**After:**

```ts
import { AiStream } from '@nest-native/ai-sdk';
import { Body, Controller, Post } from '@nestjs/common';
import { convertToModelMessages, streamText } from 'ai';

@Controller('chat')
export class ChatController {
  @Post()
  @AiStream()
  chat(@Body() body: { messages: UIMessage[] }) {
    return streamText({
      model: 'openai/gpt-4o',
      messages: convertToModelMessages(body.messages),
    });
  }
}
```

`@Res()` and the manual `pipeUIMessageStreamToResponse(res)` call are gone. The
handler returns the `streamText` result and `@AiStream` serializes it with
`pipeUIMessageStreamToResponse()` — the same protocol on the wire. `ui-message`
is the default format, so no option is needed.

## 2. Text stream

**Before:**

```ts
@Post()
async example(@Res() res: Response) {
  const result = streamText({ model, prompt });
  result.pipeTextStreamToResponse(res);
}
```

**After:**

```ts
@Post('text')
@AiStream({ format: 'text' })
example(@Body() body: ChatDto) {
  return streamText({ model, prompt: body.prompt });
}
```

The text protocol has no UI-message envelope, so opt in with
`@AiStream({ format: 'text' })`. The package forwards only `status`/`headers` for
this format (the text protocol has no error frame), keeping the contract
faithful.

## 3. Custom data parts

The cookbook builds a custom stream with `createUIMessageStream` and pipes it
with the **standalone** `pipeUIMessageStreamToResponse({ stream, response })`
free function. `createUIMessageStream` returns a bare `ReadableStream`, which
`@AiStream` does not serialize directly — wrap it in a tiny adapter that exposes
`pipeUIMessageStreamToResponse(response, init)` and delegates to that same free
function.

**Before:**

```ts
@Post('/stream-data')
async streamData(@Res() response: Response) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: 'start' });
      writer.write({ type: 'data-custom', data: { custom: 'Hello, world!' } });
      const result = streamText({ model, prompt });
      writer.merge(result.toUIMessageStream({ sendStart: false }));
    },
  });
  pipeUIMessageStreamToResponse({ stream, response });
}
```

**After:**

```ts
// ui-stream-result.ts — lives in your app, not the package (which keeps
// "dependencies": {} and never imports AI SDK internals).
import { pipeUIMessageStreamToResponse, type UIMessageChunk } from 'ai';
import type { ServerResponse } from 'node:http';

export function toUiMessageStreamResult(stream: ReadableStream<UIMessageChunk>) {
  return {
    pipeUIMessageStreamToResponse(
      response: ServerResponse,
      init?: { status?: number; headers?: Record<string, string> },
    ) {
      pipeUIMessageStreamToResponse({ response, stream, ...init });
    },
  };
}
```

```ts
@Post('stream-data')
@AiStream()
streamData(@Body() body: ChatDto) {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: 'start' });
      writer.write({ type: 'data-custom', data: { custom: 'Hello, world!' } });
      const result = streamText({ model, prompt: body.prompt });
      writer.merge(result.toUIMessageStream({ sendStart: false }));
    },
  });

  return toUiMessageStreamResult(stream);
}
```

This is the same mechanism the [`sample/05-stream-ui`](sample/05-stream-ui/README.md)
sample uses for the v5 generative-UI replacement of the removed RSC `streamUI`.

## 4. What the migration unlocks

These are the wins the smoke test in `sample/06-migration` verifies against the
cookbook recipe.

### Input validation (pre-stream HTTP `400`)

With `@Res()` you have no Nest-native step to validate the request — a malformed
body reaches the handler and crashes it into an HTTP `500`. With `@AiStream` a
pipe runs *before* the stream opens, so bad input is a clean `400` and the stream
never opens:

```ts
@Post()
@AiStream()
chat(@Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest) {
  return streamText({ model, messages: convertToModelMessages(body.messages) });
}
```

> Validate **inputs** only. A pipe on a streaming *output* is meaningless and is
> never applied.

### Guards, interceptors, filters

Guards already run ahead of the handler even with `@Res()`, so an auth rejection
is an HTTP `401`/`403` either way — the migration does not regress that. What
`@Res()` *loses* is the rest of the pipeline: an interceptor that stamps a
pre-stream header, or an exception filter that maps a pre-stream domain error to
an HTTP status, cannot run once the handler owns the response. Under `@AiStream`
all of them run before the first byte. See
[`sample/00-showcase`](sample/00-showcase/README.md) for all four enhancer types
composing with `@AiStream`.

> Response-**transform** interceptors (a classic `ResponseTransformInterceptor`
> that rewrites the final body) are incompatible with streaming and are **not**
> auto-skipped — do not apply them to `@AiStream` routes.

### Express **and** Fastify

The cookbook recipe imports `express`'s `Response` and hands the Node response
straight to the AI SDK helper, so it is Express-only — on Fastify the handler
receives a `FastifyReply` and the helper fails. The migrated handler streams
identically on both adapters with no code change beyond the adapter you pass to
`NestFactory.create`. See [`sample/01-fastify-parity`](sample/01-fastify-parity/README.md).

### Cancel on disconnect

Instead of wiring an `AbortController` to the raw request by hand, inject
`@AiAbortSignal()` and forward it — a client disconnect then tears the upstream
model request down so the provider stops billing:

```ts
@Post()
@AiStream()
chat(@Body() body: ChatDto, @AiAbortSignal() signal: AbortSignal) {
  return streamText({ model, prompt: body.prompt, abortSignal: signal });
}
```

See [`sample/02-abort-signal`](sample/02-abort-signal/README.md).

### In-stream error frames

Errors thrown *during* stream production cannot become HTTP errors — the status
and headers are already on the wire — so the AI SDK emits a documented error
frame instead. The cookbook passes `onError` to each helper by hand; `@AiStream`
centralizes it per route or module-wide, defaulting to the AI SDK's secret-safe
`'An error occurred.'` so raw provider errors never leak:

```ts
@AiStream({ onError: () => 'The model is temporarily unavailable.' })
// or AiModule.forRoot({ onError })
```

Only ever map to vetted, non-sensitive messages. See
[`sample/03-error-mapping`](sample/03-error-mapping/README.md).

## 5. Migration checklist

- [ ] Register `AiModule.forRoot()` (or `forRootAsync`) once in the root module.
- [ ] Remove `@Res() res` from each streaming handler.
- [ ] Replace `result.pipeUIMessageStreamToResponse(res)` with `return result`.
- [ ] Replace `result.pipeTextStreamToResponse(res)` with `return result` and add
      `@AiStream({ format: 'text' })`.
- [ ] Replace standalone `pipeUIMessageStreamToResponse({ stream, response })`
      with `return toUiMessageStreamResult(stream)` (a small app-owned wrapper).
- [ ] Move per-route `headers`/`status` into `@AiStream({ headers, status })`.
- [ ] Add a `ValidationPipe` (Zod or class-validator) to validate request input.
- [ ] Forward `@AiAbortSignal()` into the AI SDK call to cancel on disconnect.
- [ ] Move any hand-written `onError` into `@AiStream({ onError })` (or the
      module default), and confirm it only emits vetted messages.
- [ ] Drop the `express`-typed `Response` import — the same handler now runs on
      Fastify too.

## 6. Version note (v4 → v5)

`@nest-native/ai-sdk` targets the Vercel AI SDK **v5** stream protocol and pins
`ai` to `^5`. The v4 → v5 rework changed the stream protocol (the UI message
stream and `convertToModelMessages` shown here are v5 APIs); pre-v5 is not
supported. If you are still on v4, upgrade the AI SDK first, then apply this
guide.
