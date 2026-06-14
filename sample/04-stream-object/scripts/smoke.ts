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
    'streamObject smoke OK: a structured object streams as partial-JSON text ' +
      'deltas through @AiStream({ format: "text" }) and the guard/pipe still ' +
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
    await assertStreamsObject(adapter.name, baseUrl);
  } finally {
    await app.close();
  }
}

/** Pre-stream: missing key is HTTP 403, never a half-streamed object. */
async function assertPreStreamGuard(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/recipe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dish: 'pancakes' }),
  });

  assert.equal(response.status, 403, `${adapter}: missing key must be 403`);
  const body = await response.text();
  assert.equal(
    body.includes('"ingredients"'),
    false,
    `${adapter}: a guard rejection must not stream any object data`,
  );
}

/** Pre-stream: invalid input is HTTP 400. */
async function assertPreStreamValidation(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/recipe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'secret' },
    body: JSON.stringify({ dish: '' }),
  });

  assert.equal(response.status, 400, `${adapter}: empty dish must be 400`);
}

/**
 * Happy path: the object streams as partial-JSON text deltas. The final
 * accumulated body must parse to the complete recipe object, and the response
 * must arrive in more than one chunk to prove it really streamed.
 */
async function assertStreamsObject(
  adapter: string,
  baseUrl: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/recipe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': 'secret' },
    body: JSON.stringify({ dish: 'crepes' }),
  });

  assert.equal(response.status, 200, `${adapter}: the stream opens with 200`);

  const { chunkCount, body } = await readChunks(response);

  assert.ok(
    chunkCount > 1,
    `${adapter}: the object must arrive across multiple chunks (got ${chunkCount})`,
  );

  const recipe = JSON.parse(body) as {
    name: string;
    ingredients: string[];
    steps: string[];
  };

  assert.equal(
    recipe.name,
    'Quick crepes',
    `${adapter}: the streamed object must complete with the recipe name`,
  );
  assert.deepEqual(
    recipe.ingredients,
    ['200g flour', '2 eggs', '300ml milk'],
    `${adapter}: the streamed object must carry the full ingredient list`,
  );
  assert.deepEqual(
    recipe.steps,
    ['Whisk the batter', 'Heat the pan', 'Cook until golden'],
    `${adapter}: the streamed object must carry the full step list`,
  );
}

/**
 * Read the response body chunk-by-chunk so the test can assert it really
 * streamed (more than one chunk) rather than buffering a single response.
 */
async function readChunks(
  response: Response,
): Promise<{ chunkCount: number; body: string }> {
  const reader = response.body?.getReader();
  assert.ok(reader, 'the response must expose a readable body');

  const decoder = new TextDecoder();
  let chunkCount = 0;
  let body = '';

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunkCount += 1;
    body += decoder.decode(value, { stream: true });
  }

  body += decoder.decode();

  return { chunkCount, body };
}

void smoke().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
