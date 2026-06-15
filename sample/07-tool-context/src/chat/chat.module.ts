import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ChatController } from './chat.controller';

@Module({
  controllers: [ChatController],
  providers: [ApiKeyGuard],
})
export class ChatModule {}
