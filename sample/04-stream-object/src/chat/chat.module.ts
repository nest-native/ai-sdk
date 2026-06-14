import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';

/**
 * The recipe module wires only the controller; the mock model is constructed
 * inline by the handler, so there is no provider to register.
 */
@Module({
  controllers: [ChatController],
})
export class ChatModule {}
