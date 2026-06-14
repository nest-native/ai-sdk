import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Express entry point. The default Nest platform is Express, so no adapter is
 * passed. Run with `npm run start --workspace nest-native-ai-sdk-fastify-parity`.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  await app.listen(3000);
}

void bootstrap();
