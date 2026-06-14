import { LanguageModel, simulateReadableStream } from 'ai';
import { Recipe } from './recipe.schema';

/**
 * An offline mock language model for the `streamObject` sample.
 *
 * `streamObject` works by asking the model to emit the object as a stream of
 * JSON *text* deltas, then validating those deltas against the schema into a
 * progressively-completed object. This mock therefore serializes a fixed recipe
 * to JSON and emits it in small chunks — exactly what a real provider streams,
 * but fully offline (no provider, no API keys), so it is safe to run in CI.
 *
 * Because `StreamObjectResult` only exposes `pipeTextStreamToResponse` (there is
 * no UI-message variant), the controller serves it with `@AiStream({ format:
 * 'text' })`. The bytes on the wire are the partial-JSON delta stream consumed
 * by the AI SDK's `useObject` hook.
 */
export function createRecipeMockModel(recipe: Recipe): LanguageModel {
  const json = JSON.stringify(recipe);
  const deltas = chunkString(json, 12);
  const chunks = [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: '1' },
    ...deltas.map(delta => ({ type: 'text-delta', id: '1', delta })),
    { type: 'text-end', id: '1' },
    {
      type: 'finish',
      finishReason: 'stop',
      usage: {
        inputTokens: 8,
        outputTokens: deltas.length,
        totalTokens: 8 + deltas.length,
      },
    },
  ];

  const model = {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'stream-object-mock-model',
    supportedUrls: {},
    doGenerate: () => {
      throw new Error('doGenerate is not used in this sample');
    },
    doStream: async () => ({
      stream: simulateReadableStream({ chunks: chunks as never }),
    }),
  };

  return model as unknown as LanguageModel;
}

/**
 * Split a string into fixed-size pieces so the mock emits the object in several
 * deltas, mirroring how a real provider streams a structured response.
 */
function chunkString(value: string, size: number): string[] {
  const pieces: string[] = [];

  for (let index = 0; index < value.length; index += size) {
    pieces.push(value.slice(index, index + size));
  }

  return pieces;
}
