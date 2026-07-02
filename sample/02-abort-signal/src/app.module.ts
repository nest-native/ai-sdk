import { AiModule } from '@nest-native/ai-sdk';
import {
  createMockLanguageModel,
  MockLanguageModel,
} from '@nest-native/ai-sdk/testing';
import { DynamicModule, Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';

@Module({})
export class AppModule {
  /**
   * Build the app around a specific model. The smoke test passes one it can
   * observe; the standalone entry points fall back to a fresh slow model.
   */
  static withModel(model: MockLanguageModel): DynamicModule {
    return {
      module: AppModule,
      imports: [AiModule.forRoot(), ChatModule.withModel(model)],
    };
  }

  static register(): DynamicModule {
    return AppModule.withModel(
      createMockLanguageModel({
        text: 'one two three four five six seven eight',
        chunkDelayInMs: 80,
        respectAbortSignal: true,
      }),
    );
  }
}
