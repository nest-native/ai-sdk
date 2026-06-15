import { LanguageModel, simulateReadableStream } from 'ai';

/**
 * A deterministic, offline mock model for the `@AiContext` sample.
 *
 * It emits a single tool call for `toolName` (with empty `{}` arguments) and
 * then finishes. `streamText` invokes the matching tool's `execute` closure when
 * it consumes that tool-call part — which is what lets the sample prove a tool
 * `execute` can read request-scoped data captured via `@AiContext`.
 *
 * Like every sample model it is fully offline: no provider, no API keys.
 */
export function createToolCallingModel(toolName: string): LanguageModel {
  const chunks = [
    { type: 'stream-start', warnings: [] },
    {
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName,
      input: '{}',
    },
    {
      type: 'finish',
      finishReason: 'tool-calls',
      usage: {
        inputTokens: 8,
        outputTokens: 1,
        totalTokens: 9,
      },
    },
  ];

  const model = {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'tool-calling-mock-model',
    supportedUrls: {},
    doGenerate: () => {
      throw new Error('doGenerate is not used in this sample');
    },
    doStream: async () => ({
      stream: simulateReadableStream({ chunks }),
    }),
  };

  return model as unknown as LanguageModel;
}
