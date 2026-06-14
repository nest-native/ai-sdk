import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * A guard that runs *before* `@AiStream` opens the stream.
 *
 * Because guards sit ahead of the interceptor in the Nest enhancer pipeline,
 * rejecting here produces a normal HTTP 403 — never an SSE/stream error frame.
 * That is the headline pre-stream error guarantee: auth failures stay HTTP
 * errors.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();

    if (request.headers['x-api-key'] === 'secret') {
      return true;
    }

    throw new ForbiddenException('Missing or invalid API key');
  }
}
