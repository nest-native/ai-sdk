# Migration Guide

The official AI SDK NestJS recipe
([`ai-sdk.dev/cookbook/api-servers/nest`](https://ai-sdk.dev/cookbook/api-servers/nest))
streams by taking over the response with `@Res()` and calling the AI SDK's
`pipe*ToResponse` helpers by hand. This guide ports every recipe in that cookbook
one-for-one to `@AiStream`.

> The complete, canonical migration guide — with a per-recipe before/after and a
> step-by-step checklist — lives in
> [`MIGRATION.md`](https://github.com/nest-native/ai-sdk/blob/main/MIGRATION.md)
> at the repository root, and a runnable before/after sample lives in
> [`sample/06-migration`](samples/catalog.md). This page summarizes it.

## TL;DR

| Concern | Cookbook (`@Res()`) | `@AiStream` |
| :--- | :--- | :--- |
| Response wiring | `@Res() res` + `result.pipe*ToResponse(res)` | `return result` |
| Guards | HTTP error on rejection | HTTP error on rejection |
| Pipes / input validation | No Nest-native place | Pre-stream HTTP `400` |
| Interceptors / filters | Bypassed | Run before the stream opens |
| Express | yes | yes |
| Fastify | no | yes |
| Client abort signal | Plumb by hand | `@AiAbortSignal()` |
| Headers / status | Set on `res` by hand | `@AiStream({ headers, status })` |
| In-stream error frame | Pass `onError` per helper | `@AiStream({ onError })` / module default |

## 1. UI message stream

**Before:**

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
  async chat(@Body() body: { messages: UIMessage[] }) {
    return streamText({
      model: 'openai/gpt-4o',
      messages: await convertToModelMessages(body.messages),
    });
  }
}
```

`@Res()` and the manual `pipeUIMessageStreamToResponse(res)` call are gone.
`ui-message` is the default format.

## 2. Text stream

Replace `result.pipeTextStreamToResponse(res)` with `return result` and add
`@AiStream({ format: 'text' })`. See [Stream Formats](stream-formats.md).

## 3. Custom data parts

The cookbook's `createUIMessageStream` + standalone
`pipeUIMessageStreamToResponse({ stream, response })` becomes
`return toUiMessageStreamResult(stream)` — a small app-owned wrapper. See
[Stream Formats](stream-formats.md) for the wrapper.

## Checklist

- [ ] Register `AiModule.forRoot()` (or `forRootAsync`) once in the root module.
- [ ] Remove `@Res() res` from each streaming handler.
- [ ] Replace `result.pipeUIMessageStreamToResponse(res)` with `return result`.
- [ ] Replace `result.pipeTextStreamToResponse(res)` with `return result` and add
      `@AiStream({ format: 'text' })`.
- [ ] Replace standalone `pipeUIMessageStreamToResponse({ stream, response })`
      with `return toUiMessageStreamResult(stream)`.
- [ ] Move per-route `headers`/`status` into `@AiStream({ headers, status })`.
- [ ] Add a `ValidationPipe` (Zod or class-validator) to validate request input.
- [ ] Forward `@AiAbortSignal()` into the AI SDK call to cancel on disconnect.
- [ ] Move any hand-written `onError` into `@AiStream({ onError })` (or the module
      default), and confirm it only emits vetted messages.
- [ ] Drop the `express`-typed `Response` import — the same handler now runs on
      Fastify too.

## Version note (current major: v7)

`@nest-native/ai-sdk` tracks the current Vercel AI SDK major: the `ai` peer is
`^7`. The v7 rework moved the provider specification (language-model interface
`v3` → `v4`), and `convertToModelMessages` is async; older majors are not
supported. Upgrade the AI SDK to v7 before applying this guide. See
[Support Policy](support-policy.md).
