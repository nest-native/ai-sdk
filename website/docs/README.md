# Documentation

Use the shortest path for the decision in front of you.

## Getting Started

- [Introduction](introduction.md): what the package does and does not own
- [Why Native](why-native.md): why a Nest-native primitive beats raw `@Res()`
- [Quick Start](quick-start.md): first module and streaming handler
- [Enhancer Pipeline](enhancer-pipeline.md): how guards, pipes, interceptors, and filters compose with streaming

## Core API

- [@AiStream](ai-stream.md): the streaming method decorator
- [@AiAbortSignal](abort-signal.md): cancel the AI SDK call on client disconnect
- [Error Mapping](error-mapping.md): pre-stream HTTP errors vs in-stream error frames
- [Stream Formats](stream-formats.md): `ui-message`, `text`, and custom data parts
- [API Reference](api-reference.md): every exported symbol and option

## Migration

- [Migration Guide](migration.md): from the cookbook's raw `@Res()` + manual piping

## Production

- [Production Patterns](production-patterns.md): cost control, back-pressure, and observability
- [Security](security.md): pre-stream auth, prompt injection, and secret leakage
- [Adapters](adapters.md): Express and Fastify behavior and parity

## Samples

- [Samples](samples/index.md): how to choose and run the sample applications
- [Sample Catalog](samples/catalog.md): feature-by-feature sample index

## Project Reference

- [Support Policy](support-policy.md): supported runtime and peer lines
- [Quality and CI](quality-and-ci.md): coverage, complexity, and release checks
- [Release Guide](release.md): package release workflow
- [Contributing](contributing.md): contribution rules and PR expectations
- [Roadmap](roadmap.md): current boundaries and future API posture
