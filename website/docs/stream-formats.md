# Stream Formats

`@AiStream` serializes the handler's result through the AI SDK's own
`pipe*ToResponse` helpers, so the wire protocol is exactly what the AI SDK
produces. The `format` option picks which protocol.

## `ui-message` (default)

The UI message stream protocol — the format consumed by `@ai-sdk/react`,
`useChat`, and the other AI SDK UI hooks. This is the default, so most handlers
need no option.

```ts
@Post()
@AiStream() // format: 'ui-message'
async chat(@Body() body: ChatDto) {
  return streamText({
    model,
    messages: await convertToModelMessages(body.messages),
  });
}
```

The package serializes via `pipeUIMessageStreamToResponse(response, init)`. This
is the only format with a documented in-stream error frame, so it is the only
format where `onError` applies. See [Error Mapping](error-mapping.md).

## `text`

A plain `text/plain` delta stream via `pipeTextStreamToResponse(response, init)`.
Opt in explicitly:

```ts
@Post('text')
@AiStream({ format: 'text' })
chat(@Body() body: ChatDto) {
  return streamText({ model, prompt: body.prompt });
}
```

The text protocol has no UI-message envelope and no error frame. The package
forwards only `status`/`headers` for this format and strips `onError`, keeping the
contract faithful.

## `streamObject`

`streamObject` produces a structured object incrementally. Serve it through the
`text` format to stream partial-JSON text deltas:

```ts
@Post('object')
@AiStream({ format: 'text' })
recipe(@Body() body: RecipeDto) {
  return streamObject({ model, schema: recipeSchema, prompt: body.prompt });
}
```

See [`sample/04-stream-object`](samples/catalog.md).

## Custom Data Parts (the v5 `streamUI` equivalent)

The RSC `streamUI` is gone in v5; its replacement is a UI message stream with
custom `data-*` parts built via `createUIMessageStream`. That free function
returns a bare `ReadableStream`, which `@AiStream` does not serialize directly.
Wrap it in a tiny **app-owned** adapter that exposes
`pipeUIMessageStreamToResponse` and delegates to the AI SDK's standalone helper —
the package keeps `"dependencies": {}` and never imports AI SDK internals itself.

```ts
// ui-stream-result.ts — lives in your app, not the package.
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
@Post('ui')
@AiStream()
ui(@Body() body: ChatDto) {
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

See [`sample/05-stream-ui`](samples/catalog.md).

## Choosing A Format

| You want | Use |
| :--- | :--- |
| `useChat` / AI SDK UI hooks | `ui-message` (default) |
| Plain token-by-token text | `text` |
| Structured object streaming | `text` with `streamObject` |
| Custom UI data parts | `ui-message` + app-owned `createUIMessageStream` wrapper |
| In-stream error frames | `ui-message` (only format with `onError`) |
