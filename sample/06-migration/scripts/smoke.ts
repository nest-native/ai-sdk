import 'reflect-metadata';
import assert from 'node:assert/strict';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';

/**
 * Proves the migration from the official AI SDK NestJS cookbook recipe (raw
 * `@Res()` + `pipe*ToResponse`) to `@AiStream` is behaviour-preserving for the
 * happy path while fixing the things the cookbook recipe cannot do natively.
 *
 * Three observable wins are asserted:
 *
 *  1. Happy-path equivalence — for each recipe (UI message, custom data part,
 *     text) the `/legacy` and `/migrated` routes produce byte-identical streams
 *     on Express. The migration changes the wiring, not the protocol on the wire.
 *  2. Input validation — the migrated route runs a `ValidationPipe` and rejects a
 *     malformed body with a clean HTTP 400 *before* the stream opens; the legacy
 *     recipe has no Nest-native place for it, so the same body crashes the
 *     handler into an HTTP 500.
 *  3. Adapter parity — the migrated recipes stream identically on Fastify, while
 *     the legacy `@Res()` recipe (Express-only by construction) fails on Fastify.
 *
 * The shared `ApiKeyGuard` rejection is HTTP 401 on both routes — guards run
 * ahead of the handler regardless — so the migration does not regress auth; it is
 * asserted on both to make that explicit.
 */

const userMessages = {
  messages: [{ role: 'user', parts: [{ type: 'text', text: 'ping' }] }],
};

const validHeaders = {
  'content-type': 'application/json',
  'x-api-key': 'secret',
};

async function smoke(): Promise<void> {
  await onExpress();
  await onFastify();

  console.log(
    'Migration smoke OK: the cookbook recipe ported to @AiStream streams ' +
      'identically on Express, adds a clean pre-stream 400 the raw @Res() ' +
      'recipe cannot, and gains Fastify parity the @Res() recipe lacks.',
  );
}

/** Express: the cookbook's native adapter — assert equivalence and the wins. */
async function onExpress(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    abortOnError: false,
    logger: false,
  });
  await app.listen(0, '127.0.0.1');

  try {
    const baseUrl = await app.getUrl();

    await assertGuardRejectsBoth(baseUrl);
    await assertStreamsAreIdentical(baseUrl, '/legacy/chat', '/migrated/chat');
    await assertStreamsAreIdentical(
      baseUrl,
      '/legacy/stream-data',
      '/migrated/stream-data',
    );
    await assertStreamsAreIdentical(baseUrl, '/legacy/text', '/migrated/text');
    await assertMigratedValidatesInput(baseUrl);
    await assertLegacyCannotValidateInput(baseUrl);
  } finally {
    await app.close();
  }
}

/** Fastify: the migrated recipes work; the legacy `@Res()` recipe does not. */
async function onFastify(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { abortOnError: false, logger: false },
  );
  await app.listen(0, '127.0.0.1');

  try {
    const baseUrl = await app.getUrl();

    await assertMigratedStreamsOnFastify(baseUrl);
    await assertLegacyFailsOnFastify(baseUrl);
  } finally {
    await app.close();
  }
}

/** The shared guard rejects an unauthenticated caller with 401 on both routes. */
async function assertGuardRejectsBoth(baseUrl: string): Promise<void> {
  for (const path of ['/legacy/chat', '/migrated/chat']) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(userMessages),
    });

    assert.equal(response.status, 401, `${path}: missing key must be HTTP 401`);
    const stream = response.headers.get('content-type') ?? '';
    assert.equal(
      /text\/event-stream/.test(stream),
      false,
      `${path}: a guard rejection must never open a stream`,
    );
  }
}

/**
 * The before/after routes must put the same bytes on the wire. The custom-data
 * stream embeds a random per-message id, so compare with those ids normalized
 * away — everything else (every protocol frame and delta) must match exactly.
 */
async function assertStreamsAreIdentical(
  baseUrl: string,
  legacyPath: string,
  migratedPath: string,
): Promise<void> {
  const legacy = await streamBody(baseUrl, legacyPath);
  const migrated = await streamBody(baseUrl, migratedPath);

  assert.equal(
    legacy.status,
    migrated.status,
    `${legacyPath} vs ${migratedPath}: status must match`,
  );
  assert.equal(
    normalize(legacy.body),
    normalize(migrated.body),
    `${legacyPath} vs ${migratedPath}: streamed bytes must be identical`,
  );
}

/** Migrated route: a malformed body is a clean pre-stream HTTP 400. */
async function assertMigratedValidatesInput(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/migrated/chat`, {
    method: 'POST',
    headers: validHeaders,
    body: JSON.stringify({ messages: [] }),
  });

  assert.equal(response.status, 400, 'migrated: empty messages must be HTTP 400');
  const body = (await response.json()) as { message: string[] };
  assert.deepEqual(
    body.message,
    ['messages must not be empty'],
    'migrated: the pipe must surface the validation error pre-stream',
  );
}

/**
 * Legacy route: with no Nest-native validation step, the same malformed body
 * reaches the handler and crashes it — a 500, not a clean 400. This is exactly
 * the gap `@AiStream` + a pipe closes.
 */
async function assertLegacyCannotValidateInput(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/legacy/chat`, {
    method: 'POST',
    headers: validHeaders,
    body: JSON.stringify({ messages: [] }),
  });

  assert.equal(
    response.status,
    500,
    'legacy: the raw @Res() recipe has no pre-stream validation, so a bad body is a 500',
  );
}

/** Migrated recipes stream correctly on Fastify (adapter parity). */
async function assertMigratedStreamsOnFastify(baseUrl: string): Promise<void> {
  const chat = await streamBody(baseUrl, '/migrated/chat');
  assert.equal(chat.status, 200, 'fastify migrated chat must be 200');
  assert.match(
    chat.body,
    /"type":"text-delta"/,
    'fastify migrated chat must stream UI message deltas',
  );

  const text = await streamBody(baseUrl, '/migrated/text');
  assert.equal(text.status, 200, 'fastify migrated text must be 200');
  assert.equal(
    text.body,
    'Echo: ping',
    'fastify migrated text must stream the echoed reply',
  );
}

/**
 * The legacy `@Res()` recipe is Express-only: it types the response as
 * `express.Response` and hands the Node response straight to the AI SDK helper.
 * On Fastify the handler receives a `FastifyReply`, so the pipe fails — an HTTP
 * 500. The migrated route, by contrast, just works on Fastify.
 */
async function assertLegacyFailsOnFastify(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/legacy/chat`, {
    method: 'POST',
    headers: validHeaders,
    body: JSON.stringify(userMessages),
  });

  assert.equal(
    response.status,
    500,
    'legacy: the Express-only @Res() recipe cannot stream on Fastify',
  );
  const stream = response.headers.get('content-type') ?? '';
  assert.equal(
    /text\/event-stream/.test(stream),
    false,
    'legacy: the failed Fastify attempt must not open a stream',
  );
}

interface StreamResponse {
  readonly status: number;
  readonly body: string;
}

/** POST the standard payload and read the full streamed body as text. */
async function streamBody(
  baseUrl: string,
  path: string,
): Promise<StreamResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: validHeaders,
    body: JSON.stringify(userMessages),
  });

  return { status: response.status, body: await response.text() };
}

/**
 * Strip the random `messageId` the UI message stream stamps on its `start`
 * frame so two independently-generated streams can be compared for equality.
 */
function normalize(body: string): string {
  return body.replace(/"messageId":"[^"]+"/g, '"messageId":"<id>"');
}

void smoke().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
