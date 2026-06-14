import 'reflect-metadata';
import assert from 'node:assert/strict';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

async function smoke(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    abortOnError: false,
    logger: false,
  });

  await app.listen(0, '127.0.0.1');

  try {
    const baseUrl = await app.getUrl();

    await assertUnauthorized(baseUrl);
    await assertBadRequest(baseUrl);
    await assertUiMessageStream(baseUrl);
    await assertTextStream(app, baseUrl);
    await assertRateLimited(baseUrl);

    console.log('Showcase smoke OK: guard, pipe, filter, and stream verified.');
  } finally {
    await app.close();
  }
}

async function assertUnauthorized(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'hello' }),
  });

  assert.equal(response.status, 401, 'missing API key must be HTTP 401');
  // The guard rejected before the stream opened, so no stream header leaked.
  assert.equal(response.headers.get('x-showcase-stream'), null);
}

async function assertBadRequest(baseUrl: string): Promise<void> {
  const response = await chatFetch(baseUrl, '/chat', { prompt: '' });

  assert.equal(response.status, 400, 'empty prompt must be HTTP 400');
}

async function assertUiMessageStream(baseUrl: string): Promise<void> {
  const response = await chatFetch(baseUrl, '/chat', { prompt: 'ping' });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-showcase-enhancer'), 'interceptor');
  assert.equal(response.headers.get('x-powered-by-ai-sdk'), 'nest-native');
  assert.equal(response.headers.get('x-showcase-stream'), 'ui-message');
  assert.match(
    response.headers.get('content-type') ?? '',
    /text\/event-stream/,
  );

  const body = await response.text();
  // The UI message protocol emits one text-delta event per token, so the
  // words arrive split across separate `data:` frames rather than contiguous.
  assert.match(body, /"type":"text-delta"/);
  assert.match(body, /"delta":"You"/);
  assert.match(body, /"delta":" ping"/);
  assert.match(body, /\[DONE\]/);
}

async function assertTextStream(
  app: INestApplication,
  baseUrl: string,
): Promise<void> {
  const response = await chatFetch(baseUrl, '/chat/text', { prompt: 'ping' });

  assert.equal(response.status, 200);
  const body = await response.text();
  assert.equal(body, 'Echo: ping');
  assert.ok(app);
}

async function assertRateLimited(baseUrl: string): Promise<void> {
  // The controller starts with a quota of 3 and the UI test already used one.
  await chatFetch(baseUrl, '/chat', { prompt: 'one' });
  await chatFetch(baseUrl, '/chat', { prompt: 'two' });

  const response = await chatFetch(baseUrl, '/chat', { prompt: 'too many' });

  assert.equal(response.status, 429, 'exhausted quota must be HTTP 429');
  const body = (await response.json()) as { message: string };
  assert.equal(body.message, 'Showcase quota exhausted');
}

function chatFetch(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': 'showcase-secret',
    },
    body: JSON.stringify(body),
  });
}

void smoke().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
