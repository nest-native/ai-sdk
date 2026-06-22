import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import type { ServerResponse } from 'node:http';
import {
  convertToModelMessages,
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  streamText,
} from 'ai';
import { ApiKeyGuard } from '../common/api-key.guard';
import { ChatRequest } from './chat.schema';
import { createMockModel } from './mock-model';

/**
 * BEFORE: the official AI SDK NestJS cookbook recipe, ported verbatim in shape.
 *
 * https://ai-sdk.dev/cookbook/api-servers/nest recommends raw `@Res()` plus the
 * AI SDK's `pipe*ToResponse` helpers. This controller reproduces all three of
 * its recipes so the migration to {@link MigratedChatController} (the AFTER
 * controller) is a true before/after.
 *
 * The cost of `@Res()` is that the handler takes over the response object, so it
 * sits *outside* the Nest enhancer pipeline's response handling:
 *
 * - There is no Nest-native return value, so interceptors that wrap the response
 *   and exception filters that map a thrown error to an HTTP body can no longer
 *   do their job — the handler already owns the socket.
 * - You must remember to plumb the client abort signal, headers, status, and the
 *   secret-safe in-stream `onError` mapper by hand on every route.
 *
 * The migration replaces every one of these handlers with a one-line
 * `return`-ing `@AiStream` handler. See `MIGRATION.md`.
 *
 * `@Res()` is intentionally typed as the structural Node `ServerResponse` so the
 * same controller compiles and runs on Express *and* Fastify — the cookbook
 * imports `express`'s `Response`, but the AI SDK's `pipe*ToResponse` helpers only
 * need the Node response, which both adapters expose.
 */
@Controller('legacy')
@UseGuards(ApiKeyGuard)
export class LegacyChatController {
  /** Recipe 1: UI message stream (the format `useChat` consumes). */
  @Post('chat')
  async chat(
    @Body() body: ChatRequest,
    @Res() res: ServerResponse,
  ): Promise<void> {
    const prompt = lastUserText(body);
    const result = streamText({
      model: createMockModel(`You said: ${prompt}`),
      messages: await convertToModelMessages(body.messages as never),
    });

    result.pipeUIMessageStreamToResponse(res);
  }

  /** Recipe 2: a UI message stream carrying a custom `data-*` part. */
  @Post('stream-data')
  streamData(@Body() body: ChatRequest, @Res() res: ServerResponse): void {
    const prompt = lastUserText(body);
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: 'start' });
        writer.write({
          type: 'data-custom',
          data: { custom: `migrating: ${prompt}` },
        });

        const result = streamText({
          model: createMockModel(`You said: ${prompt}`),
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

    pipeUIMessageStreamToResponse({ stream, response: res });
  }

  /** Recipe 3: a plain text delta stream. */
  @Post('text')
  async text(
    @Body() body: ChatRequest,
    @Res() res: ServerResponse,
  ): Promise<void> {
    const prompt = lastUserText(body);
    const result = streamText({
      model: createMockModel(`Echo: ${prompt}`),
      messages: await convertToModelMessages(body.messages as never),
    });

    result.pipeTextStreamToResponse(res);
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
