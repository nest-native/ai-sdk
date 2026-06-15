import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * The users this offline sample recognizes, keyed by API key.
 */
const USERS_BY_KEY: Record<string, { id: string; name: string }> = {
  'key-alice': { id: 'u-alice', name: 'Alice' },
  'key-bob': { id: 'u-bob', name: 'Bob' },
};

export interface AuthenticatedUser {
  id: string;
  name: string;
}

/**
 * A pre-stream guard that authenticates the caller from an `x-api-key` header
 * and attaches the resolved user to the request.
 *
 * The key insight the sample demonstrates: a guard runs *before* the stream
 * opens and decorates the request, but an AI SDK tool's `execute` runs *inside*
 * the stream — too late for an ordinary parameter decorator. `@AiContext()`
 * bridges that gap, so the tool can read `request.user` the guard attached.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();

    const apiKey = request.headers['x-api-key'];
    const user = apiKey ? USERS_BY_KEY[apiKey] : undefined;

    if (!user) {
      // A pre-stream rejection is an HTTP 401 — never a half-open stream.
      throw new UnauthorizedException('Unknown or missing API key');
    }

    request.user = user;

    return true;
  }
}
