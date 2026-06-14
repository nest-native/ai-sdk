import 'reflect-metadata';
import assert from 'node:assert/strict';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';

interface AdapterCase {
  readonly name: string;
  readonly create: () => Promise<INestApplication>;
}

interface AdapterObservations {
  readonly uiBody: string;
  readonly textBody: string;
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
      NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter(),
        { abortOnError: false, logger: false },
      ),
  },
];

async function smoke(): Promise<void> {
  const observations = new Map<string, AdapterObservations>();

  for (const adapter of adapters) {
    observations.set(adapter.name, await runAdapter(adapter));
  }

  assertParity(observations);

  console.log(
    'Fastify parity smoke OK: guard, pipe, filter, and both stream formats ' +
      'behave identically on Express and Fastify.',
  );
}

async function runAdapter(adapter: AdapterCase): Promise<AdapterObservations> {
  const app = await adapter.create();
  await app.listen(0, '127.0.0.1');

  try {
    const baseUrl = await app.getUrl();

    await assertUnauthorized(adapter.name, baseUrl);
    await assertBadRequest(adapter.name, baseUrl);
    const uiBody = await assertUiMessageStream(adapter.name, baseUrl);
    const textBody = await assertTextStream(adapter.name, baseUrl);
    await assertQuotaExceeded(adapter.name, baseUrl);

    return { uiBody, textBody };
  } finally {
    await app.close();
  }
}

async function assertUnauthorized(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'hello' }),
  });

  assert.equal(response.status, 401, `${adapter}: missing API key must be 401`);
  // The guard rejected before the stream opened, so no stream header leaked.
  assert.equal(response.headers.get('x-stream'), null, `${adapter}: no leak`);
}

async function assertBadRequest(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const response = await chatFetch(baseUrl, '/chat', { prompt: '' });

  assert.equal(response.status, 400, `${adapter}: empty prompt must be 400`);
}

async function assertUiMessageStream(
  adapter: string,
  baseUrl: string,
): Promise<string> {
  const response = await chatFetch(baseUrl, '/chat', { prompt: 'ping' });

  assert.equal(response.status, 200, `${adapter}: ui stream status`);
  assert.equal(response.headers.get('x-stream'), 'ui-message', `${adapter}`);
  assert.equal(
    response.headers.get('x-powered-by-ai-sdk'),
    'nest-native',
    `${adapter}: default header`,
  );
  assert.match(
    response.headers.get('content-type') ?? '',
    /text\/event-stream/,
    `${adapter}: ui content-type`,
  );

  const body = await response.text();
  assert.match(body, /"type":"text-delta"/, `${adapter}: ui frames`);
  assert.match(body, /"delta":"You"/, `${adapter}: ui first token`);
  assert.match(body, /"delta":" ping"/, `${adapter}: ui last token`);
  assert.match(body, /\[DONE\]/, `${adapter}: ui terminator`);

  return body;
}

async function assertTextStream(
  adapter: string,
  baseUrl: string,
): Promise<string> {
  const response = await chatFetch(baseUrl, '/chat/text', { prompt: 'ping' });

  assert.equal(response.status, 200, `${adapter}: text stream status`);
  const body = await response.text();
  assert.equal(body, 'Echo: ping', `${adapter}: text stream body`);

  return body;
}

async function assertQuotaExceeded(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  // The controller starts with a quota of 2 and the UI test already used one.
  await chatFetch(baseUrl, '/chat', { prompt: 'one more' });

  const response = await chatFetch(baseUrl, '/chat', { prompt: 'too many' });

  assert.equal(response.status, 429, `${adapter}: exhausted quota must be 429`);
  const body = (await response.json()) as { message: string };
  assert.equal(body.message, 'Parity quota exhausted', `${adapter}: 429 body`);
}

function assertParity(observations: Map<string, AdapterObservations>): void {
  const express = observations.get('express');
  const fastify = observations.get('fastify');

  assert.ok(express, 'express observations missing');
  assert.ok(fastify, 'fastify observations missing');

  assert.equal(
    fastify.textBody,
    express.textBody,
    'text stream bodies must match across adapters',
  );
  assert.equal(
    stripSseTransport(fastify.uiBody),
    stripSseTransport(express.uiBody),
    'UI message stream payloads must match across adapters',
  );
}

/**
 * Normalize away SSE transport whitespace so the comparison focuses on the AI
 * SDK protocol payload, which is what must be identical across adapters.
 */
function stripSseTransport(body: string): string {
  return body.replace(/\r\n/g, '\n').replace(/\n+/g, '\n').trim();
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
      'x-api-key': 'parity-secret',
    },
    body: JSON.stringify(body),
  });
}

void smoke().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
