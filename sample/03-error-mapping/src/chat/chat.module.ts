import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';

/**
 * The chat module wires only the controller; the mock models are constructed
 * inline by the handlers, so there is no provider to register.
 */
@Module({
  controllers: [ChatController],
})
export class ChatModule {}
