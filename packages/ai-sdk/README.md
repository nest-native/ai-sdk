# @nest-native/ai-sdk

<p align="center">Decorator-first NestJS streaming primitive for the Vercel AI SDK that preserves the full Nest enhancer pipeline.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nest-native/ai-sdk"><img src="https://img.shields.io/npm/v/@nest-native/ai-sdk.svg" alt="NPM Version" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="Package License" /></a>
</p>

> [!WARNING]
> **Status: scaffold / under construction.** This is the `v0.0.1-scaffold`
> bootstrap. Only `AiModule.forRoot()` / `AiModule.forRootAsync()` exist today.
> The streaming decorators (`@AiStream`, `@AiAbortSignal`, `@AiContext`) land in
> later milestones. Do not depend on this in production yet.

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
| HTTP adapter | Express and Fastify (parity is a project goal) |

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

## Usage (scaffold)

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

## Links

- Source and issues: [github.com/nest-native/ai-sdk](https://github.com/nest-native/ai-sdk)
- Changelog: [CHANGELOG.md](../../CHANGELOG.md)
- Vercel AI SDK: [ai-sdk.dev](https://ai-sdk.dev)
- The nest-native family: [@nest-native/drizzle](https://www.npmjs.com/package/@nest-native/drizzle), [@nest-native/trpc](https://www.npmjs.com/package/@nest-native/trpc)
