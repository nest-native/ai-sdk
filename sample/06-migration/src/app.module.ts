import { AiModule } from '@nest-native/ai-sdk';
import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';

/**
 * Root module for the migration sample.
 *
 * `AiModule.forRoot()` is registered with defaults; the migrated controller
 * relies on the module being present for `@AiStream` to resolve its
 * configuration. The legacy controller needs nothing from the module — it owns
 * the response directly — which is itself part of the contrast.
 */
@Module({
  imports: [AiModule.forRoot(), ChatModule],
})
export class AppModule {}
