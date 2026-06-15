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
  for (const adapter of adapters) {
    await runAdapter(adapter);
  }

  console.log(
    'Tool-context smoke OK: an AI SDK tool execute closure read the ' +
      'guard-attached user via @AiContext on both Express and Fastify.',
  );
}

async function runAdapter(adapter: AdapterCase): Promise<void> {
  const app = await adapter.create();
  await app.listen(0, '127.0.0.1');

  try {
    const baseUrl = await app.getUrl();

    await assertUnauthorized(adapter.name, baseUrl);
    await assertToolReadsUser(adapter.name, baseUrl);
  } finally {
    await app.close();
  }
}

async function assertUnauthorized(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/chat`, { method: 'POST' });

  // The guard rejects pre-stream, so this is an HTTP 401 — never a half-open
  // stream carrying an error frame.
  assert.equal(
    response.status,
    401,
    `${adapter}: missing API key must be a pre-stream 401`,
  );
}

async function assertToolReadsUser(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'x-api-key': 'key-alice' },
  });

  assert.equal(response.status, 200, `${adapter}: stream opens with 200`);

  const body = await response.text();

  // The tool's `execute` ran mid-stream and read `request.user` (attached by
  // the guard) through the captured `@AiContext` value. Its output — Alice's
  // identity — is serialized into the UI message stream as a tool-output part.
  assert.match(
    body,
    /u-alice/,
    `${adapter}: the tool output must carry the authenticated user id`,
  );
  assert.match(
    body,
    /Alice/,
    `${adapter}: the tool output must carry the authenticated user name`,
  );
}

void smoke().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
