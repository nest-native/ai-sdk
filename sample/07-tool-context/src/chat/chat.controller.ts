import {
  AiContext,
  AiExecutionContext,
  AiStream,
  AiStreamResult,
} from '@nest-native/ai-sdk';
import { Controller, Post, UseGuards } from '@nestjs/common';
import { jsonSchema, streamText, tool } from 'ai';
import { ApiKeyGuard, AuthenticatedUser } from './api-key.guard';
import { createToolCallingModel } from './tool-calling-model';

const WHOAMI = 'whoami';

/**
 * The whole point of this sample is `@AiContext()` plus the `whoami` tool.
 *
 * An AI SDK tool's `execute` closure runs *inside* the stream, after the handler
 * has returned — so it cannot use ordinary Nest parameter decorators to reach
 * the current request. `@AiContext()` injects a request-scoped context
 * (`{ request, response, signal }`) that the handler captures and the tool
 * closes over. Here the `ApiKeyGuard` attaches `request.user` before the stream
 * opens, and the tool reads that very user back through `ctx.request`.
 *
 * It works identically on Express and Fastify: `request`/`response` come from
 * the active adapter, and `signal` is the same client-disconnect signal
 * `@AiAbortSignal()` resolves.
 */
@UseGuards(ApiKeyGuard)
@Controller('chat')
export class ChatController {
  @Post()
  @AiStream()
  chat(@AiContext() ctx: AiExecutionContext): AiStreamResult {
    const request = ctx.request as { user?: AuthenticatedUser };

    return streamText({
      model: createToolCallingModel(WHOAMI),
      prompt: 'Who is the current user?',
      tools: {
        [WHOAMI]: tool({
          description: 'Return the authenticated caller.',
          inputSchema: jsonSchema<Record<string, never>>({
            type: 'object',
            properties: {},
            additionalProperties: false,
          }),
          // Reads the user the guard attached pre-stream, reachable here only
          // through the captured `@AiContext` value.
          execute: async () => ({
            user: request.user ?? { id: 'anonymous', name: 'Anonymous' },
          }),
        }),
      },
    });
  }
}
