import { AiStream, AiStreamResult } from '@nest-native/ai-sdk';
import { createMockLanguageModel } from '@nest-native/ai-sdk/testing';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  convertToModelMessages,
  createUIMessageStream,
  streamText,
} from 'ai';
import { ApiKeyGuard } from '../common/api-key.guard';
import { ChatRequest, chatRequestSchema } from './chat.schema';
import { toUiMessageStreamResult } from './ui-stream-result';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * AFTER: the official cookbook recipe migrated to `@AiStream`.
 *
 * Every handler in {@link LegacyChatController} is reproduced here, line-for-line
 * in behaviour, but with the migration applied:
 *
 * - `@Res() res` and the manual `result.pipe*ToResponse(res)` call are gone. The
 *   handler simply `return`s the AI SDK stream result; `@AiStream` serializes it.
 * - Because the handler returns a value instead of seizing the response, the full
 *   Nest enhancer pipeline is back in play: the `ApiKeyGuard` rejection is a
 *   clean HTTP 401 (never a stream frame), and a `ZodValidationPipe` failure is a
 *   clean HTTP 400 — both *before* the first byte.
 * - The `text` recipe is one option flip: `@AiStream({ format: 'text' })`.
 * - The custom-data recipe's standalone `pipeUIMessageStreamToResponse({ stream,
 *   response })` becomes `return toUiMessageStreamResult(stream)`.
 *
 * The route prefix mirrors `LegacyChatController` so the smoke test can hit the
 * same paths under `/migrated` and assert byte-identical streams.
 */
@Controller('migrated')
@UseGuards(ApiKeyGuard)
export class MigratedChatController {
  /** Recipe 1: UI message stream (the format `useChat` consumes). */
  @Post('chat')
  @AiStream()
  async chat(
    @Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest,
  ): Promise<AiStreamResult> {
    const prompt = lastUserText(body);

    return streamText({
      model: createMockLanguageModel({ text: `You said: ${prompt}` }),
      messages: await convertToModelMessages(body.messages as never),
    });
  }

  /** Recipe 2: a UI message stream carrying a custom `data-*` part. */
  @Post('stream-data')
  @AiStream()
  streamData(@Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest) {
    const prompt = lastUserText(body);
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: 'start' });
        writer.write({
          type: 'data-custom',
          data: { custom: `migrating: ${prompt}` },
        });

        const result = streamText({
          model: createMockLanguageModel({ text: `You said: ${prompt}` }),
          messages: await convertToModelMessages(body.messages as never),
        });
        writer.merge(
          result.toUIMessageStream({
            sendStart: false,
            onError: error =>
              error instanceof Error ? error.message : String(error),
          }),
        );
      },
    });

    return toUiMessageStreamResult(stream);
  }

  /** Recipe 3: a plain text delta stream — one option flip. */
  @Post('text')
  @AiStream({ format: 'text' })
  async text(
    @Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequest,
  ): Promise<AiStreamResult> {
    const prompt = lastUserText(body);

    return streamText({
      model: createMockLanguageModel({ text: `Echo: ${prompt}` }),
      messages: await convertToModelMessages(body.messages as never),
    });
  }
}

/**
 * Pull the most recent user message's text out of the `useChat` payload. The
 * mock model echoes it so the streamed output is deterministic and assertable;
 * a real provider would consume the full message history instead.
 */
function lastUserText(body: ChatRequest): string {
  const userMessages = body.messages.filter(message => message.role === 'user');
  const lastUser = userMessages[userMessages.length - 1];

  return lastUser.parts.map(part => part.text).join(' ');
}
