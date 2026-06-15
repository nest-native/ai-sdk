import assert from 'node:assert/strict';
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
import { jsonSchema, streamText, tool } from 'ai';
import { createToolCallingModel } from './fixtures/tool-calling-model';
import { AiContext } from '../decorators/ai-context.decorator';
import { AiStream } from '../decorators/ai-stream.decorator';
import { AiStreamInterceptor } from '../ai-stream.interceptor';
import { AiModule } from '../ai.module';
import { AiExecutionContext } from '../interfaces';

const WHOAMI = 'whoami';
const TOOL_RECORDER = Symbol('TOOL_RECORDER');

type ToolRecorder = (value: string | undefined) => void;

interface ToolProbe {
  /** Resolves with the value the tool's `execute` read from `@AiContext`. */
  readonly seen: Promise<string | undefined>;
}

function createToolProbe(): {
  probe: ToolProbe;
  record: ToolRecorder;
} {
  let record: ToolRecorder = () => undefined;
  const seen = new Promise<string | undefined>(resolve => {
    record = resolve;
  });

  return { probe: { seen }, record };
}

@Controller('chat')
class ChatController {
  constructor(@Inject(TOOL_RECORDER) private readonly record: ToolRecorder) {}

  @Post()
  @AiStream()
  chat(@AiContext() ctx: AiExecutionContext) {
    const record = this.record;

    return streamText({
      model: createToolCallingModel(WHOAMI),
      prompt: 'who am I?',
      tools: {
        [WHOAMI]: tool({
          description: 'Return the caller identified by their API key header.',
          inputSchema: jsonSchema<Record<string, never>>({
            type: 'object',
            properties: {},
            additionalProperties: false,
          }),
          // The closure runs mid-stream, after the handler returned. It reaches
          // the request only through the `@AiContext` value captured above —
          // exactly the request-scoped access the decorator exists to give.
          execute: async () => {
            const request = ctx.request as {
              headers?: Record<string, string | undefined>;
            };
            const apiKey = request.headers?.['x-api-key'];
            record(apiKey);

            return { caller: apiKey ?? 'anonymous' };
          },
        }),
      },
    });
  }
}

@Module({})
class ChatModule {
  static withProbe(record: ToolRecorder): DynamicModule {
    return {
      module: ChatModule,
      imports: [AiModule.forRoot()],
      controllers: [ChatController],
      providers: [
        { provide: TOOL_RECORDER, useValue: record },
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
  describe(`@AiContext tool execute on ${adapter.name}`, () => {
    let app: INestApplication;
    let baseUrl: string;
    let probe: ToolProbe;

    before(async () => {
      const { probe: created, record } = createToolProbe();
      probe = created;
      app = await adapter.create(ChatModule.withProbe(record));
      await app.listen(0, '127.0.0.1');
      baseUrl = await app.getUrl();
    });

    after(async () => {
      await app.close();
    });

    it("lets a streamText tool's execute read request-scoped data via @AiContext", async () => {
      const response = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: { 'x-api-key': 'secret-key' },
      });

      assert.equal(response.status, 200);

      // Drain the stream so the tool call is consumed and `execute` runs.
      await response.text();

      // The tool's execute closure saw the request-scoped header through the
      // `@AiContext` value the handler captured.
      assert.equal(await probe.seen, 'secret-key');
    });
  });
}
