# Samples

The repository ships runnable samples that each isolate one part of the
integration. They live under
[`sample/`](https://github.com/nest-native/ai-sdk/tree/main/sample) and never
call a real model provider — every sample streams from the mock models in
[`@nest-native/ai-sdk/testing`](../testing.md), so no API keys are needed.

Each sample is a workspace with a `typecheck` step and a `smoke` test. The smoke
tests boot the app, exercise the route, and assert the streamed payloads,
enhancer behavior, and adapter parity.

## Running Them

```bash
npm run ci:sample      # showcase + all focused samples
npm run showcase       # just sample/00-showcase
npm run sample:focused # all focused samples in folder order
npm run test --workspace nest-native-ai-sdk-showcase
```

`npm run ci:sample` is what CI runs. It builds the package, then runs the
showcase and the focused samples.

## Where To Start

- Start with the [Sample Catalog](catalog.md) to find the sample for a given
  feature.
- The richest one is [`00-showcase`](catalog.md) — it wires a guard, a Zod pipe,
  an interceptor, and an exception filter around `@AiStream` all at once.
- For a before/after of the official cookbook recipe, see `06-migration` and the
  [Migration Guide](../migration.md).
