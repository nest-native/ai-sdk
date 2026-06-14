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
    'streamUI (v5 equivalent) smoke OK: a UI message stream with a custom ' +
      'data-weather part streams through @AiStream and the guard/pipe still ' +
      'reject before the first byte, on both Express and Fastify.',
  );
}

async function runAdapter(adapter: AdapterCase): Promise<void> {
  const app = await adapter.create();
  await app.listen(0, '127.0.0.1');

  try {
    const baseUrl = await app.getUrl();

    await assertPreStreamGuard(adapter.name, baseUrl);
    await assertPreStreamValidation(adapter.name, baseUrl);
    await assertStreamsCustomDataPart(adapter.name, baseUrl);
  } finally {
    await app.close();
  }
}

/** Pre-stream: missing key is HTTP 403, never a half-streamed UI message. */
async function assertPreStreamGuard(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/weather`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ city: 'Lisbon' }),
  });

  assert.equal(response.status, 403, `${adapter}: missing key must be 403`);
  const body = await response.text();
  assert.equal(
    body.includes('data-weather'),
    false,
    `${adapter}: a guard rejection must not stream any UI part`,
  );
}

/** Pre-stream: invalid input is HTTP 400. */
async function assertPreStreamValidation(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/weather`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'secret' },
    body: JSON.stringify({ city: '' }),
  });

  assert.equal(response.status, 400, `${adapter}: empty city must be 400`);
}

/**
 * Happy path: the UI message stream carries the text deltas *and* a custom
 * `data-weather` part whose payload is the full forecast.
 */
async function assertStreamsCustomDataPart(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/weather`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'secret' },
    body: JSON.stringify({ city: 'Lisbon' }),
  });

  assert.equal(response.status, 200, `${adapter}: the stream opens with 200`);
  assert.match(
    response.headers.get('content-type') ?? '',
    /text\/event-stream/,
    `${adapter}: a UI message stream uses the SSE content type`,
  );

  const frames = parseSseFrames(await response.text());

  const textDelta = frames.find(frame => frame.type === 'text-delta');
  assert.ok(textDelta, `${adapter}: the stream must carry a text delta`);
  assert.match(
    String(textDelta.delta),
    /Lisbon/,
    `${adapter}: the text delta must mention the requested city`,
  );

  const weather = frames.find(frame => frame.type === 'data-weather');
  assert.ok(weather, `${adapter}: the stream must carry the data-weather part`);
  assert.deepEqual(
    weather.data,
    { city: 'Lisbon', temperatureC: 21, condition: 'Partly cloudy' },
    `${adapter}: the data-weather part must carry the full forecast payload`,
  );
}

/**
 * Parse the `data: {...}` JSON frames out of an AI SDK UI message SSE stream,
 * skipping the terminal `[DONE]` sentinel.
 */
function parseSseFrames(body: string): Array<Record<string, unknown>> {
  const frames: Array<Record<string, unknown>> = [];

  for (const line of body.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed.startsWith('data:')) {
      continue;
    }

    const payload = trimmed.slice('data:'.length).trim();

    if (payload === '[DONE]') {
      continue;
    }

    frames.push(JSON.parse(payload) as Record<string, unknown>);
  }

  return frames;
}

void smoke().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
