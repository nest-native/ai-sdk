# Adapters

Express and Fastify parity is a shipped goal, not an assumption. The same
`@AiStream` handler streams identically on both adapters, verified by twin
samples and an end-to-end suite per adapter.

## How Parity Works

`@AiStream` writes to the underlying Node `ServerResponse`, which both adapters
expose:

- **Express** returns the Node `ServerResponse` directly from `getResponse()`.
- **Fastify** returns a `FastifyReply` whose `.raw` property is the underlying
  `ServerResponse`.

The package normalizes both: it resolves the raw Node response from whichever
shape the adapter hands it. That is why the cookbook's Express-only recipe (which
imports `express`'s `Response` type) becomes adapter-agnostic under `@AiStream`.

## Fastify `reply.hijack()`

On Fastify, `@AiStream` calls `reply.hijack()` before streaming. This tells
Fastify to relinquish control of the response lifecycle so the AI SDK can own the
raw socket. Without it, Fastify would still try to send its own reply after the
stream — which throws `ERR_HTTP_HEADERS_SENT` when a client disconnects
mid-stream.

Express has no equivalent and omits `hijack`, so the package calls it only when
present. This is the one adapter-specific behavior in the package, and it is
internal — your handler code is identical on both.

## Switching Adapters

Nothing in your controller changes. Only the bootstrap differs:

```ts
// Express
const app = await NestFactory.create(AppModule);
```

```ts
// Fastify
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
);
```

## Verified By

- [`sample/01-fastify-parity`](samples/catalog.md) mounts one controller on both
  an Express app and a Fastify app and asserts the streamed payloads match
  byte-for-byte.
- The package end-to-end suite mirrors the Express tests on Fastify (pre-stream
  guard rejection, text and UI message streams, pre-stream filter).
- [`sample/02-abort-signal`](samples/catalog.md) verifies disconnect
  cancellation on both adapters.

## Related

- [@AiAbortSignal](abort-signal.md) — disconnect handling across adapters.
- [Quick Start](quick-start.md) — installing the adapter peer.
