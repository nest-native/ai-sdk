import { AiModule } from '@nest-native/ai-sdk';
import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';

/**
 * Root module for the `streamObject` sample.
 *
 * `AiModule.forRoot()` is registered with defaults; the route serves a
 * structured object as a partial-JSON text stream via `@AiStream({ format:
 * 'text' })`.
 */
@Module({
  imports: [AiModule.forRoot(), ChatModule],
})
export class AppModule {}
