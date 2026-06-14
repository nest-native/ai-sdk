# API Reference

Every public symbol exported from `@nest-native/ai-sdk`.

## Module

### `AiModule.forRoot(options?)`

Registers the module with synchronous configuration. Returns a global
`DynamicModule` by default.

```ts
AiModule.forRoot({
  isGlobal: true,
  defaultHeaders: { 'x-powered-by': 'nest-native-ai-sdk' },
  onError: (error) => 'An error occurred.',
});
```

### `AiModule.forRootAsync(options?)`

Registers the module with configuration resolved through a factory.

```ts
AiModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    defaultHeaders: { 'x-app': config.getOrThrow('APP_NAME') },
  }),
});
```

### `AI_MODULE_OPTIONS`

The injection token for the resolved `AiModuleOptions`. Inject it to read the
global configuration directly.

## Decorators

### `@AiStream(options?)`

Method decorator. Turns a Nest HTTP handler into an AI SDK streaming endpoint.
See [@AiStream](ai-stream.md).

### `@AiAbortSignal()`

Parameter decorator. Injects an `AbortSignal` that fires on client disconnect.
See [@AiAbortSignal](abort-signal.md).

## Interfaces and Types

### `AiModuleOptions`

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `isGlobal` | `boolean` | `true` | Register the module globally. |
| `defaultHeaders` | `Record<string, string>` | — | Headers applied to every `@AiStream` response. Method headers override matching keys. |
| `onError` | `AiStreamErrorMapper` | AI SDK default | Default in-stream error mapper. Method-level `onError` overrides it. `ui-message` only. |

### `AiModuleAsyncOptions`

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `isGlobal` | `boolean` | `true` | Register the module globally. |
| `imports` | `ModuleMetadata['imports']` | `[]` | Modules to import for the factory. |
| `inject` | `any[]` | `[]` | Providers injected into `useFactory`. |
| `extraProviders` | `Provider[]` | `[]` | Extra providers registered alongside the options. |
| `useFactory` | `(...args) => AiModuleOptions \| Promise<AiModuleOptions>` | required | Resolves the options. |

### `AiStreamOptions`

| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `format` | `AiStreamFormat` | `'ui-message'` | Wire format. |
| `headers` | `Record<string, string>` | — | Headers merged over module defaults; method keys win. |
| `status` | `number` | `200` | HTTP status for the streaming response. |
| `onError` | `AiStreamErrorMapper` | module default | In-stream error mapper. `ui-message` only. |

### `AiStreamFormat`

`'ui-message' | 'text'`. See [Stream Formats](stream-formats.md).

### `AiStreamErrorMapper`

`(error: unknown) => string`. Maps an error thrown during stream production to the
message carried by the AI SDK's in-stream error frame. Return only vetted,
non-sensitive messages. See [Error Mapping](error-mapping.md).

### `AiStreamResult`

The structural shape `@AiStream` knows how to serialize. Both `streamText` and
`streamObject` results satisfy it, so the package does not import concrete AI SDK
classes (keeping `ai` a peer dependency).

```ts
interface AiStreamResult {
  pipeUIMessageStreamToResponse?: (response: ServerResponse, init?: AiStreamResponseInit) => void;
  pipeTextStreamToResponse?: (response: ServerResponse, init?: AiStreamResponseInit) => void;
}
```

### `AiStreamResponseInit`

```ts
interface AiStreamResponseInit {
  status?: number;
  headers?: Record<string, string>;
  onError?: AiStreamErrorMapper;
}
```

The init forwarded to the AI SDK's `pipe*ToResponse` helpers. `onError` is
forwarded only for the `ui-message` format.

### `AiPlatformResponse` and `AiHttpServerResponse`

Structural views of the platform response the package normalizes across adapters.
`AiPlatformResponse.raw` is Fastify's underlying Node response;
`AiPlatformResponse.hijack` is Fastify's `reply.hijack()`. Express omits both. See
[Adapters](adapters.md).

## What Is Not Exported

The package does **not** export model providers, prompt templates, tool
registries, or agent state — those live in your application or another package.
See the [Roadmap](roadmap.md) for the scope boundary.
