# `@AiAbortSignal`

`@AiAbortSignal()` is a parameter decorator that injects an `AbortSignal` which
fires when the client disconnects mid-stream. Forward it into your AI SDK call so
a disconnect cancels the upstream model request — and the provider stops billing
— instead of streaming tokens into a dead socket.

```ts
import { AiAbortSignal, AiStream } from '@nest-native/ai-sdk';
import { Body, Controller, Post } from '@nestjs/common';
import { streamText } from 'ai';

@Controller('chat')
export class ChatController {
  @Post()
  @AiStream()
  chat(@Body() body: ChatDto, @AiAbortSignal() signal: AbortSignal) {
    // When the client aborts the fetch, `signal` aborts and the AI SDK tears
    // down the model request.
    return streamText({ model, prompt: body.prompt, abortSignal: signal });
  }
}
```

## How The Signal Is Derived

The signal is derived from the active response's lifecycle, not the request:

- The AI SDK writes the stream to the underlying Node `ServerResponse`.
- When the client goes away mid-stream, that response emits `close` *before* it
  has `finish`ed.
- `@AiAbortSignal()` listens for that early `close` and aborts the controller.

Using the **response** (not the request) is deliberate. The request stream can
`close` as soon as its body is read — long before the client disconnects — so it
is not a reliable disconnect signal during streaming. The response only closes
early when the socket is actually torn down.

If the response has already ended or been destroyed when the signal is resolved,
the returned signal is already aborted.

## Adapter Behavior

The signal works identically on Express and Fastify. Express exposes the Node
`ServerResponse` directly; Fastify exposes it via `reply.raw`. The package
normalizes both, so the same handler behaves the same on either adapter.

## Memoization

The signal is memoized on the response. Declaring `@AiAbortSignal()` more than
once on the same handler — or resolving it repeatedly — returns the **same**
signal backed by a single `AbortController`. There is no listener leak: the
internal `finish`/`close` listeners detach themselves once either fires.

## Cost Control

Forwarding the abort signal is the primary cost-control lever for streaming LLM
endpoints. Without it, a client that closes the tab still leaves the model
generating tokens you pay for. Combine it with rate limiting and a `maxTokens`/
`maxOutputTokens` guard in your AI SDK call. See
[Production Patterns](production-patterns.md) and [Security](security.md).

## Related

- [`sample/02-abort-signal`](samples/catalog.md) — a focused sample whose smoke
  test disconnects mid-stream and asserts the AI SDK call is cancelled on both
  adapters.
- [@AiStream](ai-stream.md) — the streaming decorator the signal pairs with.
