import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AiModuleAsyncOptions, AiModuleOptions } from './interfaces';

/**
 * Injection token for the resolved {@link AiModuleOptions}.
 *
 * Consumers that need the global AI configuration can inject this token. The
 * streaming decorators added in later milestones resolve their defaults from
 * the same provider.
 */
export const AI_MODULE_OPTIONS = Symbol('AI_MODULE_OPTIONS');

/**
 * Root module for `@nest-native/ai-sdk`.
 *
 * At this scaffold milestone the module only registers global configuration so
 * applications can wire it into their root module. The `@AiStream`,
 * `@AiAbortSignal`, and `@AiContext` primitives arrive in later milestones and
 * build on this same module shell.
 */
@Module({})
export class AiModule {
  /**
   * Register the module with synchronous configuration.
   */
  static forRoot(options: AiModuleOptions = {}): DynamicModule {
    const optionsProvider: Provider = {
      provide: AI_MODULE_OPTIONS,
      useValue: options,
    };

    return {
      module: AiModule,
      global: options.isGlobal ?? true,
      providers: [optionsProvider],
      exports: [optionsProvider],
    };
  }

  /**
   * Register the module with asynchronous configuration resolved through a
   * factory.
   */
  static forRootAsync(options: AiModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: AI_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: AiModule,
      global: options.isGlobal ?? true,
      imports: options.imports ?? [],
      providers: [...(options.extraProviders ?? []), optionsProvider],
      exports: [optionsProvider],
    };
  }
}
