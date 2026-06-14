import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';

/**
 * The weather module wires only the controller; the UI message stream is built
 * inline by the handler, so there is no provider to register.
 */
@Module({
  controllers: [ChatController],
})
export class ChatModule {}
