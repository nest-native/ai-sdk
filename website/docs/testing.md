# Testing

You can exercise `@AiStream` handlers end-to-end without a real model provider.
The `@nest-native/ai-sdk/testing` entrypoint ships deterministic, fully offline
AI SDK v4 language models — no provider package, no API keys, no network — built
around the AI SDK's own public `simulateReadableStream` helper. They are the
same models every sample and e2e test in this repository streams from.

The entrypoint is deliberately separate from the package root, so test
scaffolding never enters your production import surface, and it adds no runtime
dependencies: `ai` stays a peer and `"dependencies": {}` stays empty.

## `createMockLanguageModel`

Build a model that streams a reply through the v4 stream-part protocol
(`stream-start` → `text-start` → `text-delta`* → `text-end` → `finish`) and pass
it wherever a `LanguageModel` goes:

```ts
import { createMockLanguageModel } from '@nest-native/ai-sdk/testing';
import { streamText } from 'ai';

@Post()
@AiStream()
chat(@Body() body: ChatDto) {
  return streamText({
    model: createMockLanguageModel({ text: `You said: ${body.prompt}` }),
    prompt: body.prompt,
  });
}
```

A `string` reply is split into word deltas (`'You said: hi'` streams as `'You'`,
`' said:'`, `' hi'`), reconstructing the reply byte-for-byte on the client.

### Options

| Option | Type | What it does |
| :--- | :--- | :--- |
| `text` | `string \| string[]` | The reply to stream. A `string` streams word deltas; a `string[]` streams one delta per element, exactly as given. |
| `error` | `unknown` | Fail *mid-stream*: after the text deltas the model emits the AI SDK's documented in-stream `error` frame instead of finishing. |
| `chunks` | `object[]` | Raw v4 stream parts to emit verbatim — the escape hatch for protocols `text` does not cover. Mutually exclusive with `text`. |
| `chunkDelayInMs` | `number` | Delay between chunks (default `0`). Give a disconnect test a window to abort mid-stream. |
| `respectAbortSignal` | `boolean` | Observe `doStream`'s `abortSignal` and tear the stream down on abort, as a real provider does. Default `false`. |

### Structured output (`streamObject`)

Pass explicit deltas to control the chunk boundaries — for example fixed-size
partial-JSON slices, which is exactly what a provider streams for a structured
response:

```ts
const json = JSON.stringify({ name: 'Quick pancakes' });
const deltas = [json.slice(0, 12), json.slice(12)];

return streamObject({
  model: createMockLanguageModel({ text: deltas }),
  schema: recipeSchema,
  prompt,
});
```

### In-stream failures

With `error` set, the stream opens, emits its deltas, and then fails with the
in-stream error frame — the status and headers are already on the wire, so this
is how a provider failure surfaces after the first byte. Use it to test your
[`onError` mapping](error-mapping.md):

```ts
return streamText({
  model: createMockLanguageModel({
    text: 'Partial answer',
    error: new Error('upstream provider key sk-live-… was rejected'),
  }),
  prompt,
});
```

### Disconnect tests and observers

Every mock exposes three observation hooks alongside the model members:

- `capturedSignal()` — the `abortSignal` the AI SDK forwarded into the most
  recent `doStream` call.
- `started()` — resolves once `doStream` has been invoked.
- `settled()` — resolves once the stream has been fully read or cancelled;
  await it before ending a disconnect test so the aborted teardown never leaks
  asynchronous activity past the test.

Combined with `respectAbortSignal: true` and a non-zero `chunkDelayInMs`, they
let a test prove a client disconnect propagates all the way into the model call
— which is what stops upstream billing with a real provider. From AI SDK v7,
`streamText` no longer force-cancels the model stream on abort (it relies on the
provider honoring the signal), so the bridge is opt-in and mirrors real provider
behavior:

```ts
const model = createMockLanguageModel({
  text: 'one two three four five six',
  chunkDelayInMs: 80,
  respectAbortSignal: true,
});

// ...boot the app with `model`, start a request, read the first bytes...
await model.started();
controller.abort(); // the client disconnects mid-stream

// The signal @AiAbortSignal() forwarded into streamText must have aborted.
assert.equal(model.capturedSignal()?.aborted, true);
await model.settled();
```

See [`sample/02-abort-signal`](https://github.com/nest-native/ai-sdk/tree/main/sample/02-abort-signal)
for the full smoke test.

## `createToolCallingModel`

`createToolCallingModel(toolName)` builds a model that emits a single tool call
for `toolName` (with empty `{}` arguments) and then finishes. `streamText`
invokes the matching tool's `execute` closure when it consumes that part —
which is what lets a test prove a tool can read request-scoped data captured via
[`@AiContext`](ai-context.md):

```ts
import { createToolCallingModel } from '@nest-native/ai-sdk/testing';

return streamText({
  model: createToolCallingModel('whoami'),
  prompt: 'who am I?',
  tools: { whoami: tool({ /* ... */ }) },
});
```

## Notes

- Only `doStream` is implemented; calling `doGenerate` throws. The streaming
  path — which is what `@AiStream` serves — never touches it.
- Exactly one of `text` or `chunks` must be provided; `error` composes with
  `text` only.
- The models are v4-spec (`specificationVersion: 'v4'`), matching the provider
  interface `ai@7` drives.
