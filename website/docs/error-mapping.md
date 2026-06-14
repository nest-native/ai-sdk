# Error Mapping

`@AiStream` has a two-sided error model that follows the physics of streaming:
once the first byte is on the wire, the HTTP status and headers are committed and
can no longer change. So *when* an error is thrown decides *how* it surfaces.

## Pre-Stream Errors → HTTP Errors

An error thrown **before the first byte** — by a guard, a pipe, or the handler
itself before it returns the stream result — flows through the Nest enhancer
pipeline as a normal exception. Your exception filters map it to an HTTP response
with the appropriate status. The stream never opens.

```ts
@Post()
@AiStream()
@UseGuards(ApiKeyGuard) // rejects → HTTP 401, never a stream frame
chat(@Body(new ZodValidationPipe(schema)) body: ChatRequest) {
  // bad input → pre-stream HTTP 400
  return streamText({ model, messages: convertToModelMessages(body.messages) });
}
```

This is the project's headline guarantee: a pre-stream rejection is a real HTTP
error (`400`/`401`/`403`/`429`/...), **never** an SSE error frame.

## In-Stream Errors → Error Frames

An error thrown **during** stream production — after the response has started —
cannot become an HTTP error. The AI SDK serializes a documented error frame
inside the stream protocol instead, and the `onError` mapper decides what message
that frame carries.

The AI SDK's default mapper is `() => 'An error occurred.'`, which deliberately
hides server-side error details to avoid leaking secrets. Supply your own mapper
to surface a richer, *vetted* message — never raw provider errors, which may
contain credentials.

```ts
@AiStream({ onError: () => 'The model is temporarily unavailable.' })
```

Or set a module-wide default:

```ts
AiModule.forRoot({
  onError: (error) => (error instanceof RateLimitError ? 'Slow down.' : 'An error occurred.'),
});
```

A method-level `onError` overrides the module default for that route.

## Format Caveat

Only the `ui-message` format defines an error frame. The `text` format's
`pipeTextStreamToResponse` accepts no error mapper and silently drops non-text
events, so `onError` is **ignored** for `format: 'text'`. Use `ui-message` if you
need in-stream error reporting. See [Stream Formats](stream-formats.md).

## Decision Table

| Where the error is thrown | How it surfaces | Who controls the message |
| :--- | :--- | :--- |
| Guard / pipe / handler, pre-stream | HTTP error response | Your exception filters |
| During stream production (`ui-message`) | In-stream error frame | `onError` (route, then module, then AI SDK default) |
| During stream production (`text`) | No frame (events dropped) | n/a |

## Security Note

Never map an in-stream error to a message containing raw provider output, stack
traces, or anything secret. The default exists precisely to keep that data off
the wire. See [Security](security.md).

## Related

- [`sample/03-error-mapping`](samples/catalog.md) — both paths verified on
  Express and Fastify.
- [Enhancer Pipeline](enhancer-pipeline.md) — where pre-stream errors are raised.
