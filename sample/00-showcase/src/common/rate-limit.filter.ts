import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';

/**
 * Domain error raised when a caller exceeds the showcase rate limit.
 */
export class RateLimitExceededError extends Error {}

/**
 * Exception filter that maps a pre-stream {@link RateLimitExceededError} to a
 * standard HTTP 429.
 *
 * Because the handler throws before returning an AI SDK stream result, the
 * `@AiStream` interceptor never opens the stream — the filter maps the error to
 * an ordinary HTTP response, exactly as it would for a non-streaming route.
 */
@Catch(RateLimitExceededError)
export class RateLimitExceededFilter
  implements ExceptionFilter<RateLimitExceededError>
{
  catch(error: RateLimitExceededError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();

    response.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: 'Too Many Requests',
      message: error.message,
    });
  }
}
