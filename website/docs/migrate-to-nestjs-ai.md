# Migrate to @nestjs/ai

NestJS now ships an official module for the AI SDK,
[`@nestjs/ai`](https://docs.nestjs.com/ai/overview). It streams answers to the
browser on Express, Fastify and the Node adapter, which is what this package was
for, and it adds named models, retries and fallback models, budgets, agent
functions that run through Nest's enhancers, and a fake model for tests.

`@nest-native/ai-sdk` 0.6.1 is the last release. The repository is archived and
the package is deprecated on npm. Existing installs keep working, but nothing
will be fixed.

## Pick your path

`@nestjs/ai` 0.0.2 peers `@nestjs/common` and `@nestjs/core` `^12.0.0` only.

| Your application | What to do |
| :--- | :--- |
| On NestJS 12 | Move to `@nestjs/ai`: [the mapping](#the-mapping) and [the example](#before-and-after) below. |
| On NestJS 11 | Stay on 0.6.1 until you upgrade NestJS, then move to `@nestjs/ai`. Or drop this package now and pipe the AI SDK's stream yourself: [NestJS 11 without a library](#nestjs-11-without-a-library). |

## Install

```bash
npm install @nestjs/ai @nestjs/resilience
npm uninstall @nest-native/ai-sdk
```

`@nestjs/ai` needs `ai` 7, as 0.6.x does, Node.js 22 or later, and
`@nestjs/resilience`, a required peer that runs its timeouts and retries. It is
an ES module; a CommonJS application loads it through Node's `require()` of ES
modules.

## The mapping

| `@nest-native/ai-sdk` | `@nestjs/ai` |
| :--- | :--- |
| `AiModule.forRoot({ defaultHeaders, onError })` | `AiModule.forRoot({ models: { default: openai('gpt-5') }, defaults })`. Models are registered by name, and a call that names none uses `default`. |
| A handler under `@AiStream()` that returns `streamText({ model, ... })` | Inject `AiService`, take the response with `@Res()`, and `await this.ai.streamText({ prompt }).pipeUIMessageStreamToResponse(res)`. |
| `@AiStream({ format: 'text' })` | `pipeTextStreamToResponse(res)` on the same stream. |
| `headers` and `status`, on the method or in `defaultHeaders` | `pipeUIMessageStreamToResponse(res, { headers, status })`. |
| `onError`, the text of the in-stream error frame | `errorText: (error) => string`, on the same call. The default is `An error occurred.`, so no server detail leaks. |
| A guard, pipe or service that throws before the stream opens answers with a plain HTTP error | Unchanged: they run before the handler. A model call that fails before its first chunk rejects `pipeUIMessageStreamToResponse()` with nothing sent, so the route's exception filters answer it. |
| `@AiAbortSignal()`, passed on as `abortSignal` | Nothing to wire: a client that goes away cancels the stream, and that aborts the call. `abortSignal` remains an option for your own cancellation. |
| `@AiContext()`, read inside a tool's `execute` | Write the tool as an `@AgentFunction()` method and pass `caller: { request }` with the call. The method reads `ctx.request`, and runs through its class's and its own guards, interceptors, pipes and filters. |
| A `streamObject()` result under `@AiStream` | No streaming object call: `generateObject({ schema })` answers the finished object. To stream partial objects, call the AI SDK's `streamObject()` yourself and pipe it as in the [NestJS 11 path](#nestjs-11-without-a-library). |
| A `createUIMessageStream()` writer with custom `data-*` parts (sample 05) | `AiTextStream` sends the call's own chunks. Keep the AI SDK's `createUIMessageStream()` and its `pipeUIMessageStreamToResponse()` helper, as in the NestJS 11 path. |
| Fastify, where `@AiStream` hijacked the reply | `pipeUIMessageStreamToResponse()` takes the response `@Res()` injects on Express, Fastify or the Node adapter. |
| `@nest-native/ai-sdk/testing`: `createMockLanguageModel()`, `createToolCallingModel()` | `@nestjs/ai/testing`: `FakeModel` answers with text, tool calls, objects or errors; `overrideModels()` swaps configured models in a testing module; `callTool()` runs an agent function as an agent's call would. |

## Before and after

Before, on `@nest-native/ai-sdk`:

```ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AiAbortSignal, AiStream } from '@nest-native/ai-sdk';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

@Controller('chat')
export class ChatController {
  @Post()
  @AiStream()
  @UseGuards(AuthGuard)
  chat(@Body() body: ChatDto, @AiAbortSignal() signal: AbortSignal) {
    return streamText({
      model: openai('gpt-5'),
      prompt: body.prompt,
      abortSignal: signal,
    });
  }
}
```

After, on `@nestjs/ai`, with `AiModule.forRoot({ models: { default: openai('gpt-5') } })`
in the module:

```ts
import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { AiService } from '@nestjs/ai';
import type { Response } from 'express';

@Controller('chat')
export class ChatController {
  constructor(private readonly ai: AiService) {}

  @Post()
  @UseGuards(AuthGuard)
  async chat(@Body() body: ChatDto, @Res() res: Response): Promise<void> {
    await this.ai
      .streamText({ prompt: body.prompt })
      .pipeUIMessageStreamToResponse(res);
  }
}
```

`useChat()` in the browser reads the same UI message stream as before.

## NestJS 11 without a library

`@AiStream` saved a handler from writing the response itself. Without it, the
handler takes the response with `@Res()` and hands the AI SDK's stream to the
AI SDK's own helper. Guards and pipes still run before the handler, so an
unauthorized caller or a bad parameter still gets a plain HTTP error.

```ts
import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { openai } from '@ai-sdk/openai';
import { pipeUIMessageStreamToResponse, streamText } from 'ai';
import type { Response } from 'express';

@Controller('chat')
export class ChatController {
  @Post()
  @UseGuards(AuthGuard)
  async chat(@Body() body: ChatDto, @Res() res: Response): Promise<void> {
    // What @AiAbortSignal did: a client that goes away stops the model call.
    const abort = new AbortController();
    res.once('close', () => {
      if (!res.writableFinished) abort.abort();
    });
    const result = streamText({
      model: openai('gpt-5'),
      prompt: body.prompt,
      abortSignal: abort.signal,
    });
    await pipeUIMessageStreamToResponse({
      response: res,
      stream: result.toUIMessageStream({
        // What onError did: the text of the in-stream error frame.
        onError: () => 'An error occurred.',
      }),
    });
  }
}
```

On Fastify, take `@Res() reply: FastifyReply`, call `reply.hijack()`, and pass
`reply.raw` as the response.

For a test model without a library, the AI SDK ships `MockLanguageModelV4` and
`simulateReadableStream()` in `ai/test`, which `createMockLanguageModel()` was
built on.
