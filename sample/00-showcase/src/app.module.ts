import { AiModule } from '@nest-native/ai-sdk';
import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    AiModule.forRoot({
      defaultHeaders: { 'x-powered-by-ai-sdk': 'nest-native' },
    }),
    ChatModule,
  ],
})
export class AppModule {}
