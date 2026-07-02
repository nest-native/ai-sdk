/**
 * Testing utilities for `@nest-native/ai-sdk`.
 *
 * `createMockLanguageModel` and `createToolCallingModel` build deterministic,
 * fully offline AI SDK v4 language models (no provider, no API keys) around the
 * AI SDK's own `simulateReadableStream`, so streaming handlers can be exercised
 * end-to-end in tests and samples. Import them from the
 * `@nest-native/ai-sdk/testing` entrypoint — they are intentionally kept out of
 * the package root so test scaffolding never enters a consumer's production
 * import surface.
 */
export * from './mock-language-model';
