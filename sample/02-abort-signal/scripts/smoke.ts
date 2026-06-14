import 'reflect-metadata';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import {
  AbortableMockModel,
  createAbortableMockModel,
} from '../src/chat/mock-model';

interface AdapterCase {
  readonly name: string;
  readonly create: (module: ReturnType<typeof AppModule.withModel>) =>
    Promise<INestApplication>;
}

const adapters: AdapterCase[] = [
  {
    name: 'express',
    create: module =>
      NestFactory.create(module, { abortOnError: false, logger: false }),
  },
  {
    name: 'fastify',
    create: module =>
      NestFactory.create<NestFastifyApplication>(module, new FastifyAdapter(), {
        abortOnError: false,
        logger: false,
      }),
  },
];

async function smoke(): Promise<void> {
  for (const adapter of adapters) {
    await runAdapter(adapter);
  }

  console.log(
    'AbortSignal smoke OK: a mid-stream client disconnect cancels the AI SDK ' +
      'model call on both Express and Fastify.',
  );
}

async function runAdapter(adapter: AdapterCase): Promise<void> {
  // A fresh, slow, abort-recording model per adapter so the assertions never
  // observe state left behind by the other adapter's run.
  const model = createAbortableMockModel('one two three four five six', 80);
  const app = await adapter.create(AppModule.withModel(model));
  await app.listen(0, '127.0.0.1');

  try {
    const baseUrl = await app.getUrl();

    await assertBadRequest(adapter.name, baseUrl);
    await assertDisconnectCancels(adapter.name, baseUrl, model);
  } finally {
    await app.close();
  }
}

async function assertBadRequest(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: '' }),
  });

  assert.equal(response.status, 400, `${adapter}: empty prompt must be 400`);
}

async function assertDisconnectCancels(
  adapter: string,
  baseUrl: string,
  model: AbortableMockModel,
): Promise<void> {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'tell me a long story' }),
    signal: controller.signal,
  });

  assert.equal(response.status, 200, `${adapter}: stream opens with 200`);

  // Wait until the model is actually streaming, then read the first bytes so
  // the connection is genuinely mid-stream.
  await model.started();
  const reader = response.body!.getReader();
  await reader.read();

  // The captured signal is the very one `@AiAbortSignal()` forwarded into the
  // model call, and it has not aborted yet.
  const modelSignal = model.capturedSignal();
  assert.ok(modelSignal, `${adapter}: the model must receive an abort signal`);
  assert.equal(modelSignal.aborted, false, `${adapter}: not aborted mid-stream`);

  // The client disconnects mid-stream (the AbortController on the fetch).
  controller.abort();
  await reader.cancel().catch(() => undefined);

  // The disconnect must propagate all the way to the model's abort signal.
  if (!modelSignal.aborted) {
    await once(modelSignal, 'abort');
  }

  assert.equal(
    modelSignal.aborted,
    true,
    `${adapter}: client disconnect must cancel the AI SDK model call`,
  );

  // Wait for the server to finish tearing the aborted stream down before
  // moving on, so no teardown leaks into the next adapter's run.
  await model.settled();
}

void smoke().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
