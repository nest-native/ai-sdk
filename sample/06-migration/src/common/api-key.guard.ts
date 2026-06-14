import {
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Injectable,
} from '@nestjs/common';

/**
 * A guard standing in for the auth check every real chat endpoint needs.
 *
 * This guard is the whole point of the migration. With `@AiStream` it runs
 * *before* the stream opens, so a missing key is a clean HTTP 401. With the
 * official cookbook's raw `@Res()` + `pipeUIMessageStreamToResponse` recipe the
 * guard still runs, but the recipe gives you no Nest-native way to keep its
 * rejection out of an already-opened stream when you build streaming inside the
 * handler — see the before/after controllers and the smoke test for the
 * concrete contrast.
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

    throw new UnauthorizedException('Missing or invalid API key');
  }
}
