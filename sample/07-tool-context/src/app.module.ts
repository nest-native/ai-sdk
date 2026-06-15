import { AiModule } from '@nest-native/ai-sdk';
import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [AiModule.forRoot(), ChatModule],
})
export class AppModule {}
