import { AiStream } from '@nest-native/ai-sdk';
import { createMockLanguageModel } from '@nest-native/ai-sdk/testing';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { streamObject } from 'ai';
import {
  Recipe,
  RecipeRequest,
  recipeRequestSchema,
  recipeSchema,
} from './recipe.schema';
import { ApiKeyGuard } from '../common/api-key.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * A fixed recipe the mock model "generates". A real provider would produce this
 * from the prompt; keeping it deterministic keeps the sample offline and its
 * smoke test exact.
 */
function buildRecipe(dish: string): Recipe {
  return {
    name: `Quick ${dish}`,
    ingredients: ['200g flour', '2 eggs', '300ml milk'],
    steps: ['Whisk the batter', 'Heat the pan', 'Cook until golden'],
  };
}

/**
 * Demonstrates `streamObject` served through `@AiStream`.
 *
 * `streamObject` streams a structured object as a sequence of partial-JSON text
 * deltas. Its result exposes `pipeTextStreamToResponse` (but not the UI-message
 * variant), so the route opts into `@AiStream({ format: 'text' })`. The client
 * receives the same progressively-completed object the AI SDK's `useObject`
 * hook consumes, while the full Nest enhancer pipeline still runs: the guard and
 * the pipe both reject *before* the first byte, as HTTP errors.
 */
@UseGuards(ApiKeyGuard)
@Controller('recipe')
export class ChatController {
  @Post()
  @AiStream({ format: 'text' })
  generate(
    @Body(new ZodValidationPipe(recipeRequestSchema)) body: RecipeRequest,
  ) {
    return streamObject({
      model: createMockLanguageModel({
        text: recipeJsonDeltas(buildRecipe(body.dish)),
      }),
      schema: recipeSchema,
      prompt: `Write a recipe for ${body.dish}.`,
    });
  }
}

/**
 * Serialize the recipe and slice the JSON into fixed-size text deltas —
 * exactly what a real provider streams for a structured response. The explicit
 * `string[]` form of `createMockLanguageModel`'s `text` option emits one delta
 * per slice, so the client sees the object arrive progressively.
 */
function recipeJsonDeltas(recipe: Recipe): string[] {
  const json = JSON.stringify(recipe);
  const deltas: string[] = [];

  for (let index = 0; index < json.length; index += 12) {
    deltas.push(json.slice(index, index + 12));
  }

  return deltas;
}
