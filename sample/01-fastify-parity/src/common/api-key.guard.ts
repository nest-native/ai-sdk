import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Guard that runs *before* the AI SDK stream opens — on whichever adapter is
 * active.
 *
 * Nest's enhancer pipeline runs guards ahead of the `@AiStream` interceptor on
 * both Express and Fastify, so a rejection here is a real HTTP 401 on either
 * adapter, never a half-open SSE connection carrying an error frame. Reading
 * `request.headers` works identically because the package never touches the
 * raw platform request — only the response, via the adapter-agnostic writer.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();

    if (request.headers['x-api-key'] === 'parity-secret') {
      return true;
    }

    throw new UnauthorizedException('Missing API key');
  }
}
