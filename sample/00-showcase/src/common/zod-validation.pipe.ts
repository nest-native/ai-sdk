import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

/**
 * A tiny Zod pipe that validates the *inputs* of a streaming handler.
 *
 * Per the design rules, pipes validate inputs only — they are never applied to
 * the streaming output. Rejecting here happens before `@AiStream` opens the
 * stream, so a bad request returns HTTP 400 rather than a broken stream.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException(
        result.error.issues.map(issue => issue.message),
      );
    }

    return result.data;
  }
}
