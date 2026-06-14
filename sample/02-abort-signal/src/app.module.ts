import { AiModule } from '@nest-native/ai-sdk';
import { DynamicModule, Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { AbortableMockModel, createAbortableMockModel } from './chat/mock-model';

@Module({})
export class AppModule {
  /**
   * Build the app around a specific model. The smoke test passes one it can
   * observe; the standalone entry points fall back to a fresh slow model.
   */
  static withModel(model: AbortableMockModel): DynamicModule {
    return {
      module: AppModule,
      imports: [AiModule.forRoot(), ChatModule.withModel(model)],
    };
  }

  static register(): DynamicModule {
    return AppModule.withModel(
      createAbortableMockModel('one two three four five six seven eight'),
    );
  }
}
