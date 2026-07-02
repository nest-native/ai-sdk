import { AiStream, AiStreamResult } from '@nest-native/ai-sdk';
import { createMockLanguageModel } from '@nest-native/ai-sdk/testing';
import {
  Body,
  Controller,
  Post,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { streamText } from 'ai';
import { ApiKeyGuard } from '../common/api-key.guard';
import {
  RateLimitExceededError,
  RateLimitExceededFilter,
} from '../common/rate-limit.filter';
import { RequestAuditInterceptor } from '../common/request-audit.interceptor';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ChatRequest, chatRequestSchema } from './chat.schema';

/**
 * The showcase chat controller demonstrates all four enhancer types composing
 * with `@AiStream` on Express:
 *
 * - {@link ApiKeyGuard} (guard) rejects unauthenticated callers with HTTP 401
 *   before the stream opens.
 * - {@link ZodValidationPipe} (pipe) validates the request body; bad input is
 *   HTTP 400, never a stream.
 * - {@link RequestAuditInterceptor} (interceptor) stamps a header pre-stream.
 * - {@link RateLimitExceededFilter} (filter) maps a pre-stream domain error to
 *   HTTP 429.
 */
@Controller('chat')
@UseGuards(ApiKeyGuard)
@UseInterceptors(RequestAuditInterceptor)
@UseFilters(RateLimitExceededFilter)
export class ChatController {
  private remainingQuota = 3;

  /**
   * Streams a chat completion as the AI SDK UI message protocol (the format
   * `@ai-sdk/react`'s `useChat` consumes).
   */
  @Post()
  @AiStream({ headers: { 'x-showcase-stream': 'ui-message' } })
  chat(
    @Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest,
  ): AiStreamResult {
    this.consumeQuota();

    return streamText({
      model: createMockLanguageModel({ text: `You said: ${body.prompt}` }),
      prompt: body.prompt,
    });
  }

  /**
   * Streams the same completion as a plain text delta stream.
   */
  @Post('text')
  @AiStream({ format: 'text' })
  chatText(
    @Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest,
  ): AiStreamResult {
    return streamText({
      model: createMockLanguageModel({ text: `Echo: ${body.prompt}` }),
      prompt: body.prompt,
    });
  }

  private consumeQuota(): void {
    if (this.remainingQuota <= 0) {
      throw new RateLimitExceededError('Showcase quota exhausted');
    }

    this.remainingQuota -= 1;
  }
}
