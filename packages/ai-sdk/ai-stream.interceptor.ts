import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { AI_MODULE_OPTIONS } from './ai.module';
import { AI_STREAM_METADATA } from './constants';
import { isAiStreamResult, writeAiStreamToResponse } from './ai-stream-writer';
import {
  AiModuleOptions,
  AiPlatformResponse,
  AiStreamOptions,
  AiStreamResponseInit,
  AiStreamResult,
} from './interfaces';

/**
 * Interceptor that powers the {@link AiStream} decorator.
 *
 * Because guards and pipes run *before* interceptors in the Nest enhancer
 * pipeline, any rejection from them surfaces as a normal HTTP error response
 * — never as an SSE/stream error frame. That ordering is the headline
 * differentiator over the official `@Res()` cookbook recipe, and it is the
 * reason `@AiStream` is implemented as an interceptor rather than a raw
 * response decorator.
 *
 * Once the handler resolves to an AI SDK stream result, the interceptor hands
 * it to the active HTTP adapter's underlying Node response using the AI SDK's
 * own `pipe*ToResponse` helpers, preserving protocol fidelity.
 */
@Injectable()
export class AiStreamInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(AI_MODULE_OPTIONS)
    private readonly moduleOptions: AiModuleOptions = {},
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const options = this.reflector.get<AiStreamOptions | undefined>(
      AI_STREAM_METADATA,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const response = context
      .switchToHttp()
      .getResponse<AiPlatformResponse>();

    return next.handle().pipe(
      mergeMap(value => this.resolveResult(value)),
      mergeMap(result =>
        writeAiStreamToResponse(
          result,
          response,
          options.format ?? 'ui-message',
          this.buildInit(options),
        ),
      ),
      map(() => undefined),
    );
  }

  private async resolveResult(value: unknown): Promise<AiStreamResult> {
    const resolved = await value;

    if (!isAiStreamResult(resolved)) {
      throw new TypeError(
        'An @AiStream handler must return an AI SDK stream result (for ' +
          'example from streamText or streamObject), or a promise of one.',
      );
    }

    return resolved;
  }

  private buildInit(options: AiStreamOptions): AiStreamResponseInit {
    const headers = {
      ...this.moduleOptions.defaultHeaders,
      ...options.headers,
    };
    const init: AiStreamResponseInit = {};

    if (Object.keys(headers).length > 0) {
      init.headers = headers;
    }

    if (options.status !== undefined) {
      init.status = options.status;
    }

    return init;
  }
}
