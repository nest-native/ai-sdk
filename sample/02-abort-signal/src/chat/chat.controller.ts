import { AiAbortSignal, AiStream } from '@nest-native/ai-sdk';
import { Body, Controller, Inject, Post } from '@nestjs/common';
import { streamText } from 'ai';
import { AbortableMockModel } from './mock-model';
import { ChatRequest, chatRequestSchema } from './chat.schema';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * The token the mock model is provided under. The smoke test injects a model it
 * controls so it can observe the captured abort signal.
 */
export const CHAT_MODEL = Symbol('CHAT_MODEL');

/**
 * The whole point of this sample is the one line `abortSignal: signal`.
 *
 * `@AiAbortSignal()` injects an `AbortSignal` derived from the client's
 * connection. Forwarding it into `streamText` means that when the client
 * disconnects mid-stream, the AI SDK tears the upstream model request down
 * immediately — instead of streaming tokens into a dead socket and continuing
 * to bill for a response nobody will read.
 *
 * The signal works identically on Express and Fastify: the package derives it
 * from the underlying Node response, which it already normalizes across both
 * adapters.
 */
@Controller('chat')
export class ChatController {
  constructor(
    @Inject(CHAT_MODEL) private readonly abortable: AbortableMockModel,
  ) {}

  @Post()
  @AiStream()
  chat(
    @Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest,
    @AiAbortSignal() signal: AbortSignal,
  ) {
    return streamText({
      model: this.abortable.model,
      prompt: body.prompt,
      abortSignal: signal,
    });
  }
}
