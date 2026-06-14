import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INTERCEPTORS_METADATA,
} from '@nestjs/common/constants';
import { AiStream } from '../decorators/ai-stream.decorator';
import { AiStreamInterceptor } from '../ai-stream.interceptor';
import { AI_STREAM_METADATA } from '../constants';
import { AiStreamOptions } from '../interfaces';

class Controller {
  @AiStream()
  withDefaults(): void {}

  @AiStream({ format: 'text', status: 201, headers: { 'x-ai': 'on' } })
  withOptions(): void {}
}

describe('@AiStream', () => {
  it('stores empty options metadata by default', () => {
    const options = Reflect.getMetadata(
      AI_STREAM_METADATA,
      Controller.prototype.withDefaults,
    ) as AiStreamOptions;

    assert.deepEqual(options, {});
  });

  it('stores the provided options metadata', () => {
    const options = Reflect.getMetadata(
      AI_STREAM_METADATA,
      Controller.prototype.withOptions,
    ) as AiStreamOptions;

    assert.deepEqual(options, {
      format: 'text',
      status: 201,
      headers: { 'x-ai': 'on' },
    });
  });

  it('binds the AiStreamInterceptor to the handler', () => {
    const interceptors = Reflect.getMetadata(
      INTERCEPTORS_METADATA,
      Controller.prototype.withDefaults,
    ) as unknown[];

    assert.ok(interceptors.includes(AiStreamInterceptor));
  });
});
