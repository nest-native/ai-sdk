import { DynamicModule, Module } from '@nestjs/common';
import { CHAT_MODEL, ChatController } from './chat.controller';
import { AbortableMockModel } from './mock-model';

@Module({})
export class ChatModule {
  /**
   * Build the chat module around a caller-supplied model so the smoke test can
   * inject one it controls and observe the captured abort signal.
   */
  static withModel(model: AbortableMockModel): DynamicModule {
    return {
      module: ChatModule,
      controllers: [ChatController],
      providers: [{ provide: CHAT_MODEL, useValue: model }],
    };
  }
}
