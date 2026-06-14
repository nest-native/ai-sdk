# Quick Start

Install the package and the Vercel AI SDK:

```bash
npm i @nest-native/ai-sdk ai
```

Install the Nest peers:

```bash
npm i @nestjs/common @nestjs/core reflect-metadata rxjs
```

Install the HTTP adapter your application uses:

```bash
npm i @nestjs/platform-express
# or @nestjs/platform-fastify
```

The published package keeps `"dependencies": {}`. The AI SDK and the NestJS
packages are declared as `peerDependencies`, so your application installs only
the ecosystems it actually uses.

## Register `AiModule`

Register the module once in your root module. It wires the global defaults that
`@AiStream` reads from (default headers, default in-stream error mapping).

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

## Stream From A Handler

Decorate a handler with `@AiStream()` and return an AI SDK stream result (for
example from `streamText`). The decorator pipes it to the active HTTP adapter —
guards, pipes, interceptors, and exception filters all run first.

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

`ui-message` is the default wire format — the protocol consumed by
`@ai-sdk/react`'s `useChat`. To stream plain text deltas instead, opt in with
`@AiStream({ format: 'text' })`. See [Stream Formats](stream-formats.md).

## Cancel On Disconnect

Inject `@AiAbortSignal()` and forward it into the AI SDK call so a client
disconnect cancels the upstream model request (and stops billing):

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

See [@AiAbortSignal](abort-signal.md).

## Async Configuration

Use `forRootAsync()` when the configuration depends on other providers:

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

## Next Steps

- Read [@AiStream](ai-stream.md) for every option.
- Read [Enhancer Pipeline](enhancer-pipeline.md) to see how the pipeline
  composes with streaming.
- Read [Error Mapping](error-mapping.md) for the pre-stream vs in-stream model.
- Browse runnable [Samples](samples/index.md).
