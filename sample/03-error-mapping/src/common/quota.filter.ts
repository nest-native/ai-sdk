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
 * Exception filter that maps a *pre-stream* {@link QuotaExceededError} to HTTP
 * 429 on whichever adapter is active.
 *
 * This is the pre-stream half of the error model: the handler throws before it
 * returns an AI SDK stream result, so `@AiStream` never opens the stream and the
 * filter maps the error to an ordinary HTTP response — exactly as it would for a
 * non-streaming route. Contrast this with an *in-stream* failure, which can no
 * longer be an HTTP error and instead becomes a documented stream error frame.
 *
 * Express's response exposes `.json()`; Fastify's reply exposes `.send()`. The
 * filter normalizes over both so the single filter works under both adapters.
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
