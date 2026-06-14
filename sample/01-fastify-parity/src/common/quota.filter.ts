import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';

/**
 * Domain error raised when a caller exceeds the per-process quota.
 */
export class QuotaExceededError extends Error {}

/**
 * Exception filter that maps a pre-stream {@link QuotaExceededError} to HTTP
 * 429 on whichever adapter is active.
 *
 * Express's response exposes `.json()`; Fastify's reply exposes `.send()`. The
 * filter normalizes over both so the sample's single filter works under both
 * adapters — demonstrating that filter parity is the user's concern only at the
 * raw-response boundary, never inside `@AiStream` itself.
 */
@Catch(QuotaExceededError)
export class QuotaExceededFilter
  implements ExceptionFilter<QuotaExceededError>
{
  catch(error: QuotaExceededError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status: (code: number) => {
        json?: (body: unknown) => void;
        send?: (body: unknown) => void;
      };
    }>();

    const body = {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: 'Too Many Requests',
      message: error.message,
    };
    const reply = response.status(HttpStatus.TOO_MANY_REQUESTS);
    const send = reply.json ?? reply.send;
    send?.call(reply, body);
  }
}
