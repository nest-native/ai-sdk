# Sample 07 - `@AiContext` Gives a Tool's `execute` Request-Scoped Access

An AI SDK tool's `execute` closure runs *inside* the stream — after the handler
has returned. By then ordinary Nest parameter decorators can no longer reach the
current request, so a tool has no Nest-native way to know *who* is calling.
`@AiContext()` bridges that gap.

`@AiContext()` injects a request-scoped `AiExecutionContext` —
`{ request, response, signal }`. Capture it in the handler and close over it, and
a tool can read request-scoped data (the authenticated user, headers, params) and
the client-disconnect signal:

```ts
@UseGuards(ApiKeyGuard) // attaches request.user pre-stream
@Controller('chat')
export class ChatController {
  @Post()
  @AiStream()
  chat(@AiContext() ctx: AiExecutionContext) {
    const request = ctx.request as { user?: AuthenticatedUser };

    return streamText({
      model,
      prompt: 'Who is the current user?',
      tools: {
        whoami: tool({
          description: 'Return the authenticated caller.',
          inputSchema: jsonSchema({ type: 'object', properties: {} }),
          // Runs mid-stream — reaches request.user only through `ctx`.
          execute: async () => ({ user: request.user }),
        }),
      },
    });
  }
}
```

## What It Demonstrates

- **A tool's `execute` reads request-scoped data.** An `ApiKeyGuard` runs
  pre-stream and attaches `request.user`. The `whoami` tool's `execute` runs
  mid-stream and reads that very user back through the captured `@AiContext`
  value. Its output — the authenticated identity — is serialized into the UI
  message stream as a tool-output part, which the smoke test asserts on.
- **Pre-stream guard semantics still hold.** A missing or unknown API key is a
  pre-stream HTTP `401` — never a half-open stream carrying an error frame.
- **Express and Fastify parity.** The same controller runs on both adapters and
  the tool reads the request identically on each. `@AiContext` derives
  `request`/`response` from the active adapter and reuses the package's memoized
  client-disconnect signal.

Like every sample it streams from a deterministic, offline mock model — here one
that emits a single tool call so `execute` runs — with no API keys and no real
billing, so it is safe to run in CI.

## Commands

```bash
# Boots Express AND Fastify, asserts a missing key is a pre-stream 401, and that
# the tool output carries the authenticated user on both adapters.
npm run test --workspace nest-native-ai-sdk-tool-context

# Run a single adapter manually:
npm run start --workspace nest-native-ai-sdk-tool-context          # Express
npm run start:fastify --workspace nest-native-ai-sdk-tool-context  # Fastify
```

## Try It

```bash
# A known key streams the tool output identifying the caller (Alice):
curl -N -X POST localhost:3000/chat -H 'x-api-key: key-alice'

# A missing key is a pre-stream HTTP 401, not a broken stream:
curl -i -X POST localhost:3000/chat
```
