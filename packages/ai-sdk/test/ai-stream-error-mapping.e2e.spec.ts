import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  INestApplication,
  Injectable,
  Module,
  UseGuards,
} from '@nestjs/common';
import { APP_INTERCEPTOR, NestFactory } from '@nestjs/core';
import { streamText } from 'ai';
import { createFailingLanguageModel } from './fixtures/failing-model';
import { createMockLanguageModel } from './fixtures/mock-model';
import { AiStream } from '../decorators/ai-stream.decorator';
import { AiStreamInterceptor } from '../ai-stream.interceptor';
import { AiModule } from '../ai.module';

/**
 * A deliberately sensitive-looking failure message. The point of these tests is
 * that this raw text NEVER reaches the client unless a vetted mapper explicitly
 * surfaces it: the default mapper must hide it (secret-safe), and a custom
 * mapper must be able to replace it with a stable, safe message.
 */
const SECRET_FAILURE = 'provider key sk-live-DEADBEEF rejected';

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
@Controller('chat')
class ChatController {
  // Default in-stream error handling: the AI SDK hides the raw error behind its
  // secret-safe default message.
  @Get('default')
  @AiStream()
  default() {
    return streamText({
      model: createFailingLanguageModel(
        'Partial answer',
        new Error(SECRET_FAILURE),
      ),
      prompt: 'hi',
    });
  }

  // A vetted, method-level mapper rewrites the in-stream error to a stable,
  // safe message.
  @Get('mapped')
  @AiStream({ onError: () => 'The model is temporarily unavailable.' })
  mapped() {
    return streamText({
      model: createFailingLanguageModel(
        'Partial answer',
        new Error(SECRET_FAILURE),
      ),
      prompt: 'hi',
    });
  }

  // A successful UI-message stream — the happy path still works with onError set.
  @Get('ok')
  @AiStream({ onError: () => 'The model is temporarily unavailable.' })
  ok() {
    return streamText({
      model: createMockLanguageModel('Hello world'),
      prompt: 'hi',
    });
  }

  // The text format has no error frame, so an in-stream failure is dropped: the
  // client sees only the partial text. This is the documented constraint.
  @Get('text')
  @AiStream({ format: 'text', onError: () => 'should be ignored for text' })
  text() {
    return streamText({
      model: createFailingLanguageModel(
        'Partial answer',
        new Error(SECRET_FAILURE),
      ),
      prompt: 'hi',
    });
  }
}

@Module({
  imports: [AiModule.forRoot()],
  controllers: [ChatController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AiStreamInterceptor }],
})
class DefaultMapperModule {}

@Controller('chat')
class ModuleMapperController {
  @Get('default')
  @AiStream()
  fromModuleDefault() {
    return streamText({
      model: createFailingLanguageModel(
        'Partial answer',
        new Error(SECRET_FAILURE),
      ),
      prompt: 'hi',
    });
  }
}

@Module({
  imports: [
    AiModule.forRoot({ onError: () => 'Module-level fallback message.' }),
  ],
  controllers: [ModuleMapperController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AiStreamInterceptor }],
})
class ModuleMapperModule {}

/**
 * Pull the `errorText` out of an AI SDK UI message stream body, if it carries an
 * error frame (`data: {"type":"error","errorText":"..."}`).
 */
function readErrorText(body: string): string | undefined {
  for (const line of body.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed.startsWith('data:')) {
      continue;
    }

    const payload = trimmed.slice('data:'.length).trim();

    if (payload === '[DONE]') {
      continue;
    }

    const frame = JSON.parse(payload) as { type?: string; errorText?: string };

    if (frame.type === 'error') {
      return frame.errorText;
    }
  }

  return undefined;
}

describe('@AiStream error mapping end-to-end', () => {
  let app: INestApplication;
  let baseUrl: string;

  before(async () => {
    app = await NestFactory.create(DefaultMapperModule, {
      logger: false,
      abortOnError: false,
    });
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it('returns a pre-stream guard rejection as an HTTP error, never a stream frame', async () => {
    const response = await fetch(`${baseUrl}/chat/default`);

    assert.equal(response.status, 403);
    const body = (await response.json()) as { message: string };
    assert.equal(body.message, 'Missing API key');
  });

  it('hides the raw in-stream error behind the AI SDK secret-safe default', async () => {
    const response = await fetch(`${baseUrl}/chat/default`, {
      headers: { 'x-api-key': 'secret' },
    });

    // The stream opened successfully — the failure happens *after* the first
    // byte, so the HTTP status is still 200.
    assert.equal(response.status, 200);
    const body = await response.text();

    // The partial text made it through before the failure.
    assert.match(body, /Partial/);

    // The in-stream failure is a documented error frame, and the raw provider
    // message is NOT leaked: the default mapper masks it.
    const errorText = readErrorText(body);
    assert.equal(errorText, 'An error occurred.');
    assert.equal(body.includes(SECRET_FAILURE), false);
    assert.equal(body.includes('sk-live'), false);
  });

  it('rewrites the in-stream error through a method-level mapper', async () => {
    const response = await fetch(`${baseUrl}/chat/mapped`, {
      headers: { 'x-api-key': 'secret' },
    });

    assert.equal(response.status, 200);
    const body = await response.text();

    const errorText = readErrorText(body);
    assert.equal(errorText, 'The model is temporarily unavailable.');
    assert.equal(body.includes(SECRET_FAILURE), false);
  });

  it('still streams a successful UI message response with a mapper configured', async () => {
    const response = await fetch(`${baseUrl}/chat/ok`, {
      headers: { 'x-api-key': 'secret' },
    });

    assert.equal(response.status, 200);
    const body = await response.text();

    assert.match(body, /Hello/);
    assert.match(body, /world/);
    assert.match(body, /\[DONE\]/);
    // A clean stream has no error frame.
    assert.equal(readErrorText(body), undefined);
  });

  it('drops the in-stream error for the text format (no error frame)', async () => {
    const response = await fetch(`${baseUrl}/chat/text`, {
      headers: { 'x-api-key': 'secret' },
    });

    assert.equal(response.status, 200);
    const body = await response.text();

    // The text protocol streams the partial deltas and then ends without any
    // error frame — and certainly without leaking the raw error.
    assert.match(body, /Partial answer/);
    assert.equal(body.includes('error'), false);
    assert.equal(body.includes(SECRET_FAILURE), false);
  });
});

describe('@AiStream module-level error mapping end-to-end', () => {
  let app: INestApplication;
  let baseUrl: string;

  before(async () => {
    app = await NestFactory.create(ModuleMapperModule, {
      logger: false,
      abortOnError: false,
    });
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  after(async () => {
    await app.close();
  });

  it('applies the module-level onError mapper when the route sets none', async () => {
    const response = await fetch(`${baseUrl}/chat/default`);

    assert.equal(response.status, 200);
    const body = await response.text();

    assert.equal(readErrorText(body), 'Module-level fallback message.');
    assert.equal(body.includes(SECRET_FAILURE), false);
  });
});
