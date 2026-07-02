import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, describe, it } from 'node:test';
import {
  Controller,
  DynamicModule,
  INestApplication,
  Inject,
  Module,
  Post,
} from '@nestjs/common';
import { APP_INTERCEPTOR, NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { streamText } from 'ai';
import { createMockLanguageModel, MockLanguageModel } from '../testing';
import { AiAbortSignal } from '../decorators/ai-abort-signal.decorator';
import { AiStream } from '../decorators/ai-stream.decorator';
import { AiStreamInterceptor } from '../ai-stream.interceptor';
import { AiModule } from '../ai.module';

const MODEL = Symbol('ABORTABLE_MODEL');

@Controller('chat')
class ChatController {
  constructor(@Inject(MODEL) private readonly model: MockLanguageModel) {}

  @Post()
  @AiStream()
  chat(@AiAbortSignal() signal: AbortSignal) {
    return streamText({
      model: this.model,
      prompt: 'hi',
      abortSignal: signal,
    });
  }
}

@Module({})
class ChatModule {
  static withModel(model: MockLanguageModel): DynamicModule {
    return {
      module: ChatModule,
      imports: [AiModule.forRoot()],
      controllers: [ChatController],
      providers: [
        { provide: MODEL, useValue: model },
        { provide: APP_INTERCEPTOR, useClass: AiStreamInterceptor },
      ],
    };
  }
}

interface AdapterCase {
  readonly name: string;
  readonly create: (module: DynamicModule) => Promise<INestApplication>;
}

const adapters: AdapterCase[] = [
  {
    name: 'Express',
    create: module =>
      NestFactory.create(module, { abortOnError: false, logger: false }),
  },
  {
    name: 'Fastify',
    create: module =>
      NestFactory.create<NestFastifyApplication>(module, new FastifyAdapter(), {
        abortOnError: false,
        logger: false,
      }),
  },
];

for (const adapter of adapters) {
  describe(`@AiAbortSignal disconnect on ${adapter.name}`, () => {
    let app: INestApplication;
    let baseUrl: string;
    let abortable: MockLanguageModel;

    before(async () => {
      // A fresh, slow, abort-recording model per adapter so the assertions
      // never observe state left behind by the other adapter's run.
      abortable = createMockLanguageModel({
        text: 'one two three four five six',
        chunkDelayInMs: 80,
        respectAbortSignal: true,
      });
      app = await adapter.create(ChatModule.withModel(abortable));
      await app.listen(0, '127.0.0.1');
      baseUrl = await app.getUrl();
    });

    after(async () => {
      await app.close();
    });

    it('cancels the AI SDK model call when the client disconnects mid-stream', async () => {
      const controller = new AbortController();
      const response = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        signal: controller.signal,
      });

      assert.equal(response.status, 200);

      // Wait until the model has actually started streaming, then read the
      // first bytes so the connection is genuinely mid-stream.
      await abortable.started();
      const reader = response.body!.getReader();
      await reader.read();

      // The captured signal is the very one forwarded into the model call.
      const modelSignal = abortable.capturedSignal();
      assert.ok(modelSignal, 'the model must have received an abort signal');
      assert.equal(modelSignal.aborted, false);

      // Client disconnects mid-stream.
      controller.abort();
      await reader.cancel().catch(() => undefined);

      // The disconnect must propagate to the model's abort signal.
      if (!modelSignal.aborted) {
        await once(modelSignal, 'abort');
      }

      assert.equal(modelSignal.aborted, true);

      // Wait for the server to finish tearing the aborted stream down before
      // the test ends, so its teardown never leaks asynchronous activity past
      // the test (which `node:test` would flag as a failure).
      await abortable.settled();
    });
  });
}
