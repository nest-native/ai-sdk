import { simulateReadableStream } from 'ai';
import type {
  LanguageModelV4,
  LanguageModelV4StreamPart,
} from '@ai-sdk/provider';

/**
 * Build a deterministic AI SDK v4 language model that emits a single tool call
 * for `toolName` (with empty `{}` arguments) and then finishes.
 *
 * `streamText` invokes the matching tool's `execute` closure when it consumes
 * this tool-call part, which is exactly what the `@AiContext` e2e needs: it lets
 * the test prove a tool `execute` can read request-scoped data captured via
 * `@AiContext`. Fully offline — no provider, no API keys.
 */
export function createToolCallingModel(toolName: string): LanguageModelV4 {
  const chunks: LanguageModelV4StreamPart[] = [
    { type: 'stream-start', warnings: [] },
    {
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName,
      input: '{}',
    },
    {
      type: 'finish',
      finishReason: { unified: 'tool-calls', raw: undefined },
      usage: {
        inputTokens: {
          total: 8,
          noCache: 8,
          cacheRead: 0,
          cacheWrite: 0,
        },
        outputTokens: {
          total: 1,
          text: 1,
          reasoning: 0,
        },
      },
    },
  ];

  return {
    specificationVersion: 'v4',
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
