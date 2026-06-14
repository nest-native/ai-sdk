import 'reflect-metadata';
import assert from 'node:assert/strict';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';

const SECRET_FAILURE = 'upstream provider key sk-live-DEADBEEF was rejected';

interface AdapterCase {
  readonly name: string;
  readonly create: () => Promise<INestApplication>;
}

const adapters: AdapterCase[] = [
  {
    name: 'express',
    create: () =>
      NestFactory.create(AppModule, { abortOnError: false, logger: false }),
  },
  {
    name: 'fastify',
    create: () =>
      NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
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
    'Error-mapping smoke OK: pre-stream errors stay HTTP errors and in-stream ' +
      'errors become documented stream error frames (default hides the raw ' +
      'error; a custom mapper rewrites it) on both Express and Fastify.',
  );
}

async function runAdapter(adapter: AdapterCase): Promise<void> {
  const app = await adapter.create();
  await app.listen(0, '127.0.0.1');

  try {
    const baseUrl = await app.getUrl();

    await assertPreStreamGuard(adapter.name, baseUrl);
    await assertPreStreamValidation(adapter.name, baseUrl);
    await assertPreStreamQuota(adapter.name, baseUrl);
    await assertInStreamDefault(adapter.name, baseUrl);
    await assertInStreamMapped(adapter.name, baseUrl);
    await assertHappyPath(adapter.name, baseUrl);
  } finally {
    await app.close();
  }
}

/** Pre-stream: guard rejection is HTTP 403, never a stream frame. */
async function assertPreStreamGuard(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/chat/default`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'hello' }),
  });

  assert.equal(response.status, 403, `${adapter}: missing key must be 403`);
  const body = await response.text();
  assert.equal(
    body.includes('"type":"error"'),
    false,
    `${adapter}: a guard rejection must not be a stream error frame`,
  );
}

/** Pre-stream: invalid input is HTTP 400. */
async function assertPreStreamValidation(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/chat/default`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'secret' },
    body: JSON.stringify({ prompt: '' }),
  });

  assert.equal(response.status, 400, `${adapter}: empty prompt must be 400`);
}

/** Pre-stream: a handler exception maps through the filter to HTTP 429. */
async function assertPreStreamQuota(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/chat/quota`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'secret' },
    body: JSON.stringify({ prompt: 'hello' }),
  });

  assert.equal(response.status, 429, `${adapter}: quota error must be 429`);
  const body = (await response.json()) as { message: string };
  assert.equal(
    body.message,
    'Daily token quota exceeded',
    `${adapter}: the filter must map the pre-stream error message`,
  );
}

/** In-stream + default: the failure is a frame whose message hides the raw error. */
async function assertInStreamDefault(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const { status, body } = await openStream(baseUrl, 'default');

  assert.equal(status, 200, `${adapter}: the stream opens with 200`);
  assert.match(body, /Partial/, `${adapter}: partial text streams before fail`);
  assert.equal(
    readErrorText(body),
    'An error occurred.',
    `${adapter}: default mapper hides the raw error behind a safe message`,
  );
  assert.equal(
    body.includes(SECRET_FAILURE),
    false,
    `${adapter}: the raw provider error must never leak to the client`,
  );
}

/** In-stream + custom: the mapper rewrites the frame's message. */
async function assertInStreamMapped(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const { status, body } = await openStream(baseUrl, 'mapped');

  assert.equal(status, 200, `${adapter}: the stream opens with 200`);
  assert.equal(
    readErrorText(body),
    'The model is temporarily unavailable.',
    `${adapter}: custom mapper rewrites the in-stream error message`,
  );
  assert.equal(
    body.includes(SECRET_FAILURE),
    false,
    `${adapter}: the raw provider error must never leak to the client`,
  );
}

/** Happy path: a clean stream has no error frame even with a mapper set. */
async function assertHappyPath(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const { status, body } = await openStream(baseUrl, 'ok');

  assert.equal(status, 200, `${adapter}: the stream opens with 200`);
  assert.match(body, /Hello/, `${adapter}: the happy path streams the reply`);
  assert.equal(
    readErrorText(body),
    undefined,
    `${adapter}: a clean stream carries no error frame`,
  );
}

async function openStream(
  baseUrl: string,
  route: string,
): Promise<{ status: number; body: string }> {
  const response = await fetch(`${baseUrl}/chat/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'secret' },
    body: JSON.stringify({ prompt: 'Partial answer please' }),
  });

  return { status: response.status, body: await response.text() };
}

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

void smoke().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
