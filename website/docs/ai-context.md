# `@AiContext`

`@AiContext()` is a parameter decorator that injects a request-scoped
`AiExecutionContext` — `{ request, response, signal }` — into your handler.

Its purpose is narrow but important: an **AI SDK tool's `execute` closure runs
inside the stream**, after the handler has already returned. By then ordinary
Nest parameter decorators can no longer reach the current request. Capture the
context in the handler and close over it, and a tool can read request-scoped data
(the authenticated user, headers, route params) and the client-disconnect signal.

```ts
import { AiContext, AiExecutionContext, AiStream } from '@nest-native/ai-sdk';
import { Controller, Post, UseGuards } from '@nestjs/common';
import { jsonSchema, streamText, tool } from 'ai';

@UseGuards(ApiKeyGuard) // attaches request.user pre-stream
@Controller('chat')
export class ChatController {
  @Post()
  @AiStream()
  chat(@AiContext() ctx: AiExecutionContext) {
    const request = ctx.request as { user?: { id: string } };

    return streamText({
      model,
      prompt: 'who am I?',
      tools: {
        whoami: tool({
          description: 'Return the authenticated caller.',
          inputSchema: jsonSchema({ type: 'object', properties: {} }),
          // Runs mid-stream — reaches the request only through `ctx`.
          execute: async () => ({ user: request.user }),
        }),
      },
    });
  }
}
```

## What The Context Contains

`AiExecutionContext` is intentionally minimal — three fields, no broad context
bus:

| Field | Type | Description |
| :--- | :--- | :--- |
| `request` | `unknown` | The adapter's request object (Express `Request` / Fastify `FastifyRequest`). Typed as `unknown` so the package depends on neither platform; cast it to read `request.user`, headers, params. |
| `response` | `AiPlatformResponse \| ServerResponse` | The active platform response, for the rare tool that inspects response state. |
| `signal` | `AbortSignal` | The client-disconnect signal — the same one [`@AiAbortSignal`](abort-signal.md) resolves. Forward it from a long-running tool so it bails out when the client goes away. |

## Why Tools Need It

A tool's `execute` is a closure the AI SDK invokes while it streams the model's
response. It runs **after** your handler returns, so it is outside the request
the way a parameter decorator sees it. Without `@AiContext`, a tool has no
Nest-native way to know *who* is calling or *whether the client is still
connected*. Capturing `ctx` at handler time and closing over it bridges that gap
cleanly — the tool reads exactly what the request already carries.

## Adapter Behavior

`@AiContext` works identically on Express and Fastify. `request` and `response`
come from the active adapter's `ExecutionContext`, and `signal` reuses the
package's memoized client-disconnect signal (derived from the underlying Node
response, which the package normalizes across both adapters).

## Memoization

The context is memoized on the response. Declaring `@AiContext()` more than once
on the same handler — or resolving it repeatedly — returns the **same** object,
and its `signal` is the single memoized client-disconnect signal. So it never
wires a second `AbortController` for the same request, and it shares that signal
with `@AiAbortSignal()`.

## Scope Boundary

`@AiContext` is not a general-purpose context bus and does not pull in DI
services. It exposes the request, the response, and the disconnect signal — the
minimum a tool `execute` realistically needs. For anything else, inject it into
the controller via normal Nest DI and close over it the same way.

## Related

- [`sample/07-tool-context`](samples/catalog.md) — a focused sample whose smoke
  test proves a `streamText` tool's `execute` reads the guard-attached user via
  `@AiContext` on both adapters.
- [`@AiAbortSignal`](abort-signal.md) — the decorator whose disconnect signal
  `@AiContext` also exposes.
- [`@AiStream`](ai-stream.md) — the streaming decorator the context pairs with.
