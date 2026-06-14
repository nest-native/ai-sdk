import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

/**
 * A tiny Zod pipe that validates the *inputs* of a streaming handler.
 *
 * Pipes validate inputs only — never the streaming output. The pipe runs before
 * `@AiStream` opens the stream, so a bad request is HTTP 400 (a pre-stream
 * error) on both Express and Fastify rather than a broken stream.
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
