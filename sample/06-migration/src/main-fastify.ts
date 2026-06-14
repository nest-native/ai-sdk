import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

/**
 * Fastify entry point. The only difference from `main.ts` is the
 * `FastifyAdapter` passed to `NestFactory.create` — the migrated `@AiStream`
 * recipes behave identically on both adapters, and the legacy `@Res()` recipes
 * compile and run on both too (the AI SDK helpers only need the Node response).
 * Run with `npm run start:fastify --workspace nest-native-ai-sdk-migration`.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.listen(3000, '0.0.0.0');
}

void bootstrap();
