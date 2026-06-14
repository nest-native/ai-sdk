import { AiModule } from '@nest-native/ai-sdk';
import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';

/**
 * Root module for the generative-UI sample.
 *
 * `AiModule.forRoot()` is registered with defaults; the route serves a UI
 * message stream with a custom data part via the default `@AiStream()`
 * `ui-message` format.
 */
@Module({
  imports: [AiModule.forRoot(), ChatModule],
})
export class AppModule {}
