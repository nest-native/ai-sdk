import { AiModule } from '@nest-native/ai-sdk';
import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';

/**
 * Root module for the error-mapping sample.
 *
 * `AiModule.forRoot()` is registered without a default `onError`, so the
 * unmapped route keeps the AI SDK's secret-safe default in-stream message. A
 * real app could pass `onError` here to set a project-wide fallback that
 * individual routes still override via `@AiStream({ onError })`.
 */
@Module({
  imports: [AiModule.forRoot(), ChatModule],
})
export class AppModule {}
