import { AiStream } from '@nest-native/ai-sdk';
import {
  Body,
  Controller,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { streamText } from 'ai';
import { ApiKeyGuard } from '../common/api-key.guard';
import { QuotaExceededError, QuotaExceededFilter } from '../common/quota.filter';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { createMockModel } from './mock-model';
import { ChatRequest, chatRequestSchema } from './chat.schema';

/**
 * The same chat controller is mounted on both an Express app and a Fastify app
 * (see `main.ts` and `main-fastify.ts`). No adapter-specific code lives here —
 * that is the whole point of the sample: `@AiStream` gives you Express +
 * Fastify parity for free, with the enhancer pipeline (guard, pipe, filter)
 * behaving identically on both.
 */
@Controller('chat')
@UseGuards(ApiKeyGuard)
@UseFilters(QuotaExceededFilter)
export class ChatController {
  private remainingQuota = 2;

  /**
   * Streams a chat completion as the AI SDK UI message protocol.
   */
  @Post()
  @AiStream({ headers: { 'x-stream': 'ui-message' } })
  chat(@Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest) {
    this.consumeQuota();

    return streamText({
      model: createMockModel(`You said: ${body.prompt}`),
      prompt: body.prompt,
    });
  }

  /**
   * Streams the same completion as a plain text delta stream.
   */
  @Post('text')
  @AiStream({ format: 'text' })
  chatText(@Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest) {
    return streamText({
      model: createMockModel(`Echo: ${body.prompt}`),
      prompt: body.prompt,
    });
  }

  private consumeQuota(): void {
    if (this.remainingQuota <= 0) {
      throw new QuotaExceededError('Parity quota exhausted');
    }

    this.remainingQuota -= 1;
  }
}
