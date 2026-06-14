import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  ArgumentsHost,
  CanActivate,
  Catch,
  Controller,
  ExceptionFilter,
  ExecutionContext,
  ForbiddenException,
  Get,
  HttpStatus,
  INestApplication,
  Injectable,
  Module,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { APP_INTERCEPTOR, NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { streamText } from 'ai';
import { createMockLanguageModel } from './fixtures/mock-model';
import { AiStream } from '../decorators/ai-stream.decorator';
import { AiStreamInterceptor } from '../ai-stream.interceptor';
import { AiModule } from '../ai.module';

class BillingError extends Error {}

@Catch(BillingError)
class BillingExceptionFilter implements ExceptionFilter<BillingError> {
  catch(error: BillingError, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<{
      status: (code: number) => { send: (body: unknown) => void };
    }>();

    reply
      .status(HttpStatus.PAYMENT_REQUIRED)
      .send({ statusCode: HttpStatus.PAYMENT_REQUIRED, message: error.message });
  }
}

@Injectable()
class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();

    if (request.headers['x-api-key'] === 'secret') {
      return true;
    }

    throw new ForbiddenException('Missing API key');
  }
}

@UseGuards(ApiKeyGuard)
@UseFilters(BillingExceptionFilter)
@Controller('chat')
class ChatController {
  @Get('text')
  @AiStream({ format: 'text' })
  text() {
    return streamText({
      model: createMockLanguageModel('Hello world'),
      prompt: 'hi',
    });
  }

  @Get('ui')
  @AiStream()
  ui() {
    return streamText({
      model: createMockLanguageModel('Hello world'),
      prompt: 'hi',
    });
  }

  @Get('billing')
  @AiStream()
  billing(): never {
    throw new BillingError('Out of credits');
  }
}

@Module({
  imports: [AiModule.forRoot({ defaultHeaders: { 'x-ai-sdk': 'nest-native' } })],
  controllers: [ChatController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AiStreamInterceptor }],
})
class ChatModule {}

describe('@AiStream end-to-end on Fastify', () => {
  let app: INestApplication;
  let baseUrl: string;

  before(async () => {
    app = await NestFactory.create<NestFastifyApplication>(
      ChatModule,
      new FastifyAdapter(),
      { logger: false, abortOnError: false },
    );
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it('rejects a pre-stream guard failure as an HTTP error, not a stream frame', async () => {
    const response = await fetch(`${baseUrl}/chat/text`);

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal((body as { message: string }).message, 'Missing API key');
    assert.equal(response.headers.get('x-ai-sdk'), null);
  });

  it('streams plain text deltas for the text format', async () => {
    const response = await fetch(`${baseUrl}/chat/text`, {
      headers: { 'x-api-key': 'secret' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-ai-sdk'), 'nest-native');
    const text = await response.text();
    assert.equal(text, 'Hello world');
  });

  it('streams the UI message protocol for the default format', async () => {
    const response = await fetch(`${baseUrl}/chat/ui`, {
      headers: { 'x-api-key': 'secret' },
    });

    assert.equal(response.status, 200);
    assert.match(
      response.headers.get('content-type') ?? '',
      /text\/event-stream/,
    );
    const body = await response.text();
    assert.match(body, /Hello/);
    assert.match(body, /world/);
    assert.match(body, /\[DONE\]/);
  });

  it('maps a pre-stream handler exception through the filter as HTTP', async () => {
    const response = await fetch(`${baseUrl}/chat/billing`, {
      headers: { 'x-api-key': 'secret' },
    });

    assert.equal(response.status, HttpStatus.PAYMENT_REQUIRED);
    const body = (await response.json()) as { message: string };
    assert.equal(body.message, 'Out of credits');
  });
});
