import { MockLanguageModel } from '@nest-native/ai-sdk/testing';
import { DynamicModule, Module } from '@nestjs/common';
import { CHAT_MODEL, ChatController } from './chat.controller';

@Module({})
export class ChatModule {
  /**
   * Build the chat module around a caller-supplied model so the smoke test can
   * inject one it controls and observe the captured abort signal.
   */
  static withModel(model: MockLanguageModel): DynamicModule {
    return {
      module: ChatModule,
      controllers: [ChatController],
      providers: [{ provide: CHAT_MODEL, useValue: model }],
    };
  }
}
