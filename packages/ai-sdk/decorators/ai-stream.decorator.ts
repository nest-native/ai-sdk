import {
  applyDecorators,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common';
import { AI_STREAM_METADATA } from '../constants';
import { AiStreamInterceptor } from '../ai-stream.interceptor';
import { AiStreamOptions } from '../interfaces';

/**
 * Method decorator that turns a Nest HTTP handler into an AI SDK streaming
 * endpoint, replacing the official `@Res()` + `pipeUIMessageStreamToResponse`
 * cookbook recipe.
 *
 * The decorated handler returns an AI SDK stream result (for example from
 * `streamText` or `streamObject`); `@AiStream` wires it to the active HTTP
 * adapter's response while keeping the full Nest enhancer pipeline intact:
 *
 * - Guards still run *before* the stream opens, so pre-stream rejections become
 *   HTTP errors (401/403/...), never stream error frames.
 * - Pipes still validate the handler's inputs.
 * - Exception filters still map handler exceptions thrown before the first byte
 *   to HTTP responses.
 *
 * @example
 * ```ts
 * @Controller('chat')
 * export class ChatController {
 *   @Post()
 *   @AiStream()
 *   @UseGuards(ApiKeyGuard)
 *   chat(@Body() body: ChatDto) {
 *     return streamText({ model, prompt: body.prompt });
 *   }
 * }
 * ```
 */
export function AiStream(options: AiStreamOptions = {}): MethodDecorator {
  return applyDecorators(
    SetMetadata(AI_STREAM_METADATA, options),
    UseInterceptors(AiStreamInterceptor),
  );
}
