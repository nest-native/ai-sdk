import { AiStream } from '@nest-native/ai-sdk';
import {
  Body,
  Controller,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { streamText } from 'ai';
import { ChatRequest, chatRequestSchema } from './chat.schema';
import { createFailingMockModel, createWorkingMockModel } from './mock-model';
import { ApiKeyGuard } from '../common/api-key.guard';
import { QuotaExceededError, QuotaExceededFilter } from '../common/quota.filter';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * A deliberately sensitive-looking failure message. The whole point of the
 * in-stream routes is that this raw text NEVER reaches the client: the default
 * mapper hides it, and the custom mapper replaces it with a vetted message.
 */
const SECRET_FAILURE = 'upstream provider key sk-live-DEADBEEF was rejected';

/**
 * Demonstrates `@AiStream`'s two-sided error model:
 *
 * - **Pre-stream errors** (thrown by a guard, a pipe, or the handler before it
 *   returns a stream) flow through the Nest enhancer pipeline and become normal
 *   HTTP errors — 403/400/429 here. The stream is never opened.
 * - **In-stream errors** (thrown *during* stream production, after the first
 *   byte) can no longer be HTTP errors — the status and headers are already on
 *   the wire — so the AI SDK emits a documented error frame inside the stream.
 *   `onError` maps the thrown error to that frame's message, defaulting to the
 *   secret-safe `'An error occurred.'` so raw provider errors never leak.
 */
@UseGuards(ApiKeyGuard)
@UseFilters(QuotaExceededFilter)
@Controller('chat')
export class ChatController {
  // Pre-stream: the handler throws before returning a stream, so the filter maps
  // it to HTTP 429. No stream is opened.
  @Post('quota')
  @AiStream()
  quota(
    @Body(new ZodValidationPipe(chatRequestSchema)) _body: ChatRequest,
  ): never {
    throw new QuotaExceededError('Daily token quota exceeded');
  }

  // In-stream + default mapping: the model fails mid-stream. The status is
  // already 200, so the failure becomes a documented error frame whose message
  // is the AI SDK's secret-safe default — the raw error is hidden.
  @Post('default')
  @AiStream()
  default(@Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest) {
    return streamText({
      model: createFailingMockModel(body.prompt, new Error(SECRET_FAILURE)),
      prompt: body.prompt,
    });
  }

  // In-stream + custom mapping: a vetted mapper rewrites the in-stream error to
  // a stable, safe message. Never surface raw provider errors here — they may
  // contain credentials.
  @Post('mapped')
  @AiStream({ onError: () => 'The model is temporarily unavailable.' })
  mapped(@Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest) {
    return streamText({
      model: createFailingMockModel(body.prompt, new Error(SECRET_FAILURE)),
      prompt: body.prompt,
    });
  }

  // The happy path still streams cleanly with a mapper configured.
  @Post('ok')
  @AiStream({ onError: () => 'The model is temporarily unavailable.' })
  ok(@Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest) {
    return streamText({
      model: createWorkingMockModel('Hello from the model'),
      prompt: body.prompt,
    });
  }
}
