import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Guard that runs *before* the AI SDK stream opens.
 *
 * This is the headline differentiator over the official `@Res()` cookbook
 * recipe: because guards run ahead of the `@AiStream` interceptor, a rejection
 * here produces a real HTTP 401 — never a half-open SSE connection carrying an
 * error frame.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();

    if (request.headers['x-api-key'] === 'showcase-secret') {
      return true;
    }

    throw new UnauthorizedException('Missing showcase API key');
  }
}
