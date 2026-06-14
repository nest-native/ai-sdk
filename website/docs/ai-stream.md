# `@AiStream`

`@AiStream(options?)` is the method decorator that turns a Nest HTTP handler into
an AI SDK streaming endpoint. The handler returns an AI SDK stream result and the
decorator pipes it to the active HTTP adapter while preserving the full Nest
enhancer pipeline.

```ts
import { AiStream } from '@nest-native/ai-sdk';
import { Body, Controller, Post } from '@nestjs/common';
import { streamText } from 'ai';

@Controller('chat')
export class ChatController {
  @Post()
  @AiStream()
  chat(@Body() body: ChatDto) {
    return streamText({ model, prompt: body.prompt });
  }
}
```

Internally, `@AiStream` is `applyDecorators(SetMetadata(...), UseInterceptors(AiStreamInterceptor))`.
Because it is an interceptor, the whole enhancer pipeline runs before the stream
opens — see [Enhancer Pipeline](enhancer-pipeline.md).

## What The Handler Returns

The handler returns an AI SDK stream result, synchronously or as a promise that
resolves to one. The package serializes it through the AI SDK's own
`pipe*ToResponse` helpers, so the wire protocol is exactly what the AI SDK
produces:

- For the default `ui-message` format, the result must expose
  `pipeUIMessageStreamToResponse(response, init)` — `streamText` results do.
- For the `text` format, the result must expose
  `pipeTextStreamToResponse(response, init)`.

Custom streams built with `createUIMessageStream` return a bare `ReadableStream`;
wrap them in a tiny app-owned adapter that exposes
`pipeUIMessageStreamToResponse`. See [Stream Formats](stream-formats.md).

## Options

`@AiStream` accepts an `AiStreamOptions` object. Every field is optional.

### `format`

```ts
@AiStream({ format: 'text' })
```

The wire format used to serialize the result. `'ui-message'` (default) preserves
the AI SDK UI message stream protocol consumed by `@ai-sdk/react` and `useChat`.
`'text'` emits a plain `text/plain` delta stream. See
[Stream Formats](stream-formats.md).

### `headers`

```ts
@AiStream({ headers: { 'x-model': 'gpt-4o' } })
```

Extra response headers merged on top of `AiModuleOptions.defaultHeaders`.
Method-level keys win on conflict.

### `status`

```ts
@AiStream({ status: 200 })
```

The HTTP status code for the streaming response. Defaults to `200`. Because the
status is sent with the first byte, it applies only to a successful stream open —
a pre-stream rejection still uses the enhancer's HTTP status.

### `onError`

```ts
@AiStream({ onError: () => 'The model is temporarily unavailable.' })
```

The in-stream error mapper for this route. It maps an error thrown *during*
stream production to the message carried by the AI SDK's documented error frame.
It overrides `AiModuleOptions.onError`. Only the `ui-message` format defines an
error frame, so this option is ignored for `format: 'text'`. When omitted, the AI
SDK's secret-safe default (`'An error occurred.'`) is used, so raw provider errors
never leak. See [Error Mapping](error-mapping.md).

## Option Resolution

Headers and the error mapper resolve from two layers:

1. Module defaults from `AiModule.forRoot({ defaultHeaders, onError })`.
2. Method options from `@AiStream({ headers, onError })`.

Method-level values win. Headers merge per-key (method keys override matching
default keys); `onError` is replaced wholesale by the method value when present.

## Related

- [@AiAbortSignal](abort-signal.md) — cancel the AI SDK call on disconnect.
- [Error Mapping](error-mapping.md) — pre-stream vs in-stream errors.
- [API Reference](api-reference.md) — the full type surface.
