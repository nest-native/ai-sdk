import { AiStream } from '@nest-native/ai-sdk';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { streamObject } from 'ai';
import {
  Recipe,
  RecipeRequest,
  recipeRequestSchema,
  recipeSchema,
} from './recipe.schema';
import { createRecipeMockModel } from './mock-model';
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
      model: createRecipeMockModel(buildRecipe(body.dish)),
      schema: recipeSchema,
      prompt: `Write a recipe for ${body.dish}.`,
    });
  }
}
