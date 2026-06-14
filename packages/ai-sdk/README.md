# @nest-native/ai-sdk

<p align="center">Decorator-first NestJS streaming primitive for the Vercel AI SDK that preserves the full Nest enhancer pipeline.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nest-native/ai-sdk"><img src="https://img.shields.io/npm/v/@nest-native/ai-sdk.svg" alt="NPM Version" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="Package License" /></a>
</p>

> [!WARNING]
> **Status: pre-release / under construction.** `@AiStream` streams AI SDK
> results on **both Express and Fastify** while keeping the Nest enhancer
> pipeline intact, and `@AiAbortSignal` cancels the AI SDK call when the client
> disconnects mid-stream. Full error-mapping and the `streamObject` / `streamUI`
> samples land in later milestones. Do not depend on this in production yet.

## What This Is

`@nest-native/ai-sdk` is a community NestJS integration that will make Vercel AI
SDK streaming responses feel like a first-class Nest primitive — replacing the
"raw `@Res()` + manual piping" pattern with a decorator that keeps the Nest
enhancer pipeline (guards, pipes, interceptors, filters) intact.

The headline goal: a pre-stream guard rejection returns an HTTP error, not an
SSE error frame, and a client disconnect propagates an `AbortSignal` to the AI
SDK call.

## Compatibility

| Runtime | Supported line |
| --- | --- |
| Node.js | `>=20` |
| NestJS | `11.x` |
| Vercel AI SDK (`ai`) | `^5` (pin major; pre-v5 not supported) |
| HTTP adapter | Express and Fastify (parity shipped and tested) |

The published package has no runtime dependencies. The Vercel AI SDK and the
NestJS packages are declared as `peerDependencies`, so applications install only
the ecosystems they actually use.

## Installation

```bash
npm i @nest-native/ai-sdk ai
```

Required peers:

```bash
npm i @nestjs/common @nestjs/core reflect-metadata rxjs
```

## Usage

Register the module once, then decorate a handler with `@AiStream`. The handler
returns an AI SDK stream result (for example from `streamText`); the decorator
wires it to the active HTTP adapter's response.

```ts
import { Module } from '@nestjs/common';
import { AiModule } from '@nest-native/ai-sdk';

@Module({
  imports: [
    AiModule.forRoot({
      defaultHeaders: { 'x-powered-by': 'nest-native-ai-sdk' },
    }),
  ],
})
export class AppModule {}
```

```ts
import { AiStream } from '@nest-native/ai-sdk';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { streamText } from 'ai';

@Controller('chat')
export class ChatController {
  @Post()
  @AiStream()
  @UseGuards(ApiKeyGuard)
  chat(@Body() body: ChatDto) {
    // ApiKeyGuard runs BEFORE the stream opens, so a rejection is an HTTP
    // 401/403 — never an SSE error frame.
    return streamText({ model, prompt: body.prompt });
  }
}
```

`@AiStream` serializes to the AI SDK UI message protocol by default
(`pipeUIMessageStreamToResponse()`), the format `@ai-sdk/react`'s `useChat`
consumes. Pass `format: 'text'` for a plain text delta stream, or set `headers`
/ `status` per route:

```ts
@Post('text')
@AiStream({ format: 'text', headers: { 'x-stream': 'text' } })
chatText(@Body() body: ChatDto) {
  return streamText({ model, prompt: body.prompt });
}
```

Method-level `headers` merge over the module's `defaultHeaders` (method keys
win). Guards, pipes, and exception filters all run ahead of the stream, so
pre-stream rejections surface as ordinary HTTP responses.

### Express and Fastify

The same handler works on either adapter — `@AiStream` writes to the underlying
Node `ServerResponse` (Express exposes it directly; Fastify exposes it via
`reply.raw`), so you do not touch the raw response yourself. The only difference
is the adapter you pass to `NestFactory.create`:

```ts
import { FastifyAdapter } from '@nestjs/platform-fastify';

const app = await NestFactory.create(AppModule, new FastifyAdapter());
```

See [`sample/01-fastify-parity`](../../sample/01-fastify-parity/README.md) for
the same controller streaming identically on both adapters.

### Cancel on disconnect with `@AiAbortSignal`

When a client disconnects mid-stream you usually want to stop generating — the
tokens go nowhere, but the provider keeps billing. `@AiAbortSignal()` injects an
`AbortSignal` derived from the client's connection; forward it into your AI SDK
call and a disconnect tears the upstream model request down immediately:

```ts
import { AiAbortSignal, AiStream } from '@nest-native/ai-sdk';
import { Body, Controller, Post } from '@nestjs/common';
import { streamText } from 'ai';

@Controller('chat')
export class ChatController {
  @Post()
  @AiStream()
  chat(@Body() body: ChatDto, @AiAbortSignal() signal: AbortSignal) {
    return streamText({ model, prompt: body.prompt, abortSignal: signal });
  }
}
```

The signal is derived from the underlying Node response, so it works identically
on Express and Fastify, and it is memoized per request — declaring
`@AiAbortSignal()` more than once yields the same signal. See
[`sample/02-abort-signal`](../../sample/02-abort-signal/README.md) for a smoke
test that disconnects mid-stream and asserts the model call is cancelled on both
adapters.

## Links

- Source and issues: [github.com/nest-native/ai-sdk](https://github.com/nest-native/ai-sdk)
- Changelog: [CHANGELOG.md](../../CHANGELOG.md)
- Vercel AI SDK: [ai-sdk.dev](https://ai-sdk.dev)
- The nest-native family: [@nest-native/drizzle](https://www.npmjs.com/package/@nest-native/drizzle), [@nest-native/trpc](https://www.npmjs.com/package/@nest-native/trpc)
