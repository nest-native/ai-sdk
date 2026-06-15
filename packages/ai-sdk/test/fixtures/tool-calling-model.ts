import { simulateReadableStream } from 'ai';
import type {
  LanguageModelV2,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider';

/**
 * Build a deterministic AI SDK v2 language model that emits a single tool call
 * for `toolName` (with empty `{}` arguments) and then finishes.
 *
 * `streamText` invokes the matching tool's `execute` closure when it consumes
 * this tool-call part, which is exactly what the `@AiContext` e2e needs: it lets
 * the test prove a tool `execute` can read request-scoped data captured via
 * `@AiContext`. Fully offline — no provider, no API keys.
 */
export function createToolCallingModel(toolName: string): LanguageModelV2 {
  const chunks: LanguageModelV2StreamPart[] = [
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

  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'tool-calling-mock-model',
    supportedUrls: {},
    doGenerate: () => {
      throw new Error('doGenerate is not used in these tests');
    },
    doStream: async () => ({
      stream: simulateReadableStream({ chunks }),
    }),
  };
}
