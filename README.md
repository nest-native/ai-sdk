# @nest-native/ai-sdk

<p align="center">Decorator-first NestJS streaming primitive for the Vercel AI SDK that preserves the full Nest enhancer pipeline.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nest-native/ai-sdk"><img src="https://img.shields.io/npm/v/@nest-native/ai-sdk.svg" alt="NPM Version" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="Package License" /></a>
  <img src="https://img.shields.io/badge/coverage-100%25-brightgreen.svg" alt="Test Coverage" />
  <img src="https://img.shields.io/badge/version-0.1.0-blue.svg" alt="Version: 0.1.0" />
</p>

> [!NOTE]
> **Status: `0.1.0` — v1 surface complete.** `@AiStream` streams AI SDK results on
> **both Express and Fastify** while preserving the full Nest enhancer pipeline,
> `@AiAbortSignal` cancels the AI SDK call when the client disconnects mid-stream,
> pre-stream vs in-stream errors are mapped correctly, and samples cover
> `streamText`, `streamObject`, and the v5 generative-UI equivalent of `streamUI`.
> The workspace builds, typechecks, tests at 100% coverage, and is CI-green. A
> [migration guide](MIGRATION.md) ports the official AI SDK NestJS cookbook recipe
> to `@AiStream`, and a [documentation site](https://nest-native.github.io/ai-sdk/)
> is published from [`website/`](website).

## What This Is

`@nest-native/ai-sdk` is a community NestJS integration for streaming responses
from the [Vercel AI SDK](https://ai-sdk.dev). The goal is a decorator-first,
Nest-native primitive that replaces the "raw `@Res()` + manual piping" pattern
the official AI SDK cookbook recommends — while keeping the **full Nest enhancer
pipeline** (guards, pipes, interceptors, filters) intact.

It is the only Nest-native primitive aimed at AI SDK streaming. It wraps the AI
SDK's response helpers; it does not re-implement or hide the AI SDK.

## Why

NestJS integration for AI SDK streaming is missing today:

- The official cookbook uses raw `@Res()` + `pipeUIMessageStreamToResponse()`,
  which bypasses interceptors, guards, and exception filters.
- `@Sse` is structurally broken for this use case: it opens the connection
  *before* the handler runs ([`nestjs/nest#12670`](https://github.com/nestjs/nest/issues/12670)),
  so pre-flight auth errors become SSE error events instead of HTTP errors.

This package's headline differentiators:

- **Pre-stream guard semantics:** rejections become HTTP errors (401/403), not
  SSE error frames.
- **Real, tested AbortSignal propagation:** client disconnect cancels the
  underlying AI SDK call so billing stops.
- **Express + Fastify parity** is a shipped goal, not an assumption.

## Compatibility

| Runtime | Supported line |
| --- | --- |
| Node.js | `>=20` |
| NestJS | `11.x` |
| Vercel AI SDK (`ai`) | `^5` (pin major; pre-v5 not supported) |
| HTTP adapter | Express and Fastify (parity is a project goal) |
| Validation | Zod and class-validator, both app-owned |

The published package keeps `"dependencies": {}`. The Vercel AI SDK and the
NestJS packages are declared as `peerDependencies`, so applications install only
the ecosystems they actually use.

## Repository Layout

This repository contains:

- [`packages/ai-sdk`](packages/ai-sdk): the `@nest-native/ai-sdk` integration package
- [`sample`](sample): runnable samples, starting with [`sample/00-showcase`](sample/00-showcase)
- [`MIGRATION.md`](MIGRATION.md): step-by-step guide from the official cookbook's
  raw `@Res()` + `pipe*ToResponse` recipe to `@AiStream`
- [`scripts`](scripts): quality, coverage, complexity, and release-check helpers
- [`CONTRIBUTING.md`](CONTRIBUTING.md): contributor workflow, including the
  sample/library PR separation rule
- [`CHANGELOG.md`](CHANGELOG.md): release history and unreleased changes
- [`SECURITY.md`](SECURITY.md): vulnerability reporting and project security boundaries
- [`website`](website): the Docusaurus documentation site

The published [documentation site](https://nest-native.github.io/ai-sdk/) is the
recommended learning path; it is built from [`website/`](website).

## Installation

```bash
npm i @nest-native/ai-sdk ai
```

Required peers:

```bash
npm i @nestjs/common @nestjs/core reflect-metadata rxjs
```

Install the HTTP adapter your app uses:

```bash
npm i @nestjs/platform-express
# or @nestjs/platform-fastify
```

## Usage

Register `AiModule`, then decorate a handler with `@AiStream`. The handler
returns an AI SDK stream result (for example from `streamText`) and the
decorator pipes it to the active HTTP adapter — guards, pipes, interceptors, and
exception filters all run first.

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
    // The guard runs before the stream opens — a rejection is HTTP 401/403,
    // never an SSE error frame.
    return streamText({ model, prompt: body.prompt });
  }
}
```

See [`sample/00-showcase`](sample/00-showcase) for a full Express example wiring
a guard, a Zod pipe, an interceptor, and an exception filter around `@AiStream`.

Async configuration is supported through `AiModule.forRootAsync()`:

```ts
AiModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    defaultHeaders: { 'x-app': config.getOrThrow('APP_NAME') },
  }),
});
```

Both registrations return a global `DynamicModule` by default. Pass
`isGlobal: false` to scope it to a single module boundary.

## Quality Gates

The repository ships the same review posture as its sibling `@nest-native`
packages, using `node:test` and `c8`:

- package build, typecheck, and coverage on Node.js 20 and 22
- coverage with `c8`, enforced at 100% for statements, branches, functions, and lines
- sticky PR comments for coverage, test performance, and cognitive complexity
- cognitive complexity enforcement with SonarJS threshold `15`
- package tarball validation and README link validation
- supply-chain audit for high-severity issues

Run the local gate with:

```bash
npm run ci
```

## Status and Roadmap

The v1 surface is complete and released as `0.1.0`. The path that got here:

1. ~~**Bootstrap** — repo skeleton, empty package, CI green.~~ ✅
2. ~~`@AiStream` skeleton on Express with a showcase sample.~~ ✅
3. ~~Fastify parity.~~ ✅
4. ~~`@AiAbortSignal` + real disconnect test.~~ ✅
5. ~~Pre-stream vs in-stream error mapping.~~ ✅
6. ~~`streamObject` + `streamUI` samples.~~ ✅
7. ~~Migration guide from raw `@Res()` piping.~~ ✅
8. ~~Documentation site. Release `v0.1`.~~ ✅

See [CHANGELOG.md](CHANGELOG.md) for what has landed and the
[roadmap](https://nest-native.github.io/ai-sdk/docs/roadmap) for the scope
boundary.

## License

[MIT](LICENSE) © 2026 Rodrigo Nogueira.

Part of the [nest-native](https://github.com/nest-native) family, alongside
[@nest-native/drizzle](https://github.com/nest-native/drizzle) and
[@nest-native/trpc](https://github.com/nest-native/trpc).
