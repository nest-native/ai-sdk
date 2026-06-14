import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Interceptor that stamps an audit header *before* the stream opens.
 *
 * This demonstrates that pre-stream interceptor behavior composes with
 * `@AiStream`. Note the contrast called out in the guidelines: a
 * response-transform interceptor (one that maps the final returned value) is
 * incompatible with streaming and is intentionally not used here.
 */
@Injectable()
export class RequestAuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<{
      setHeader?: (name: string, value: string) => void;
      header?: (name: string, value: string) => void;
    }>();

    const setHeader = response.setHeader ?? response.header;
    setHeader?.call(response, 'x-showcase-enhancer', 'interceptor');

    return next.handle();
  }
}
