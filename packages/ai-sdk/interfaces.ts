import { ModuleMetadata, Provider } from '@nestjs/common';

/**
 * Configuration for {@link AiModule.forRoot}.
 *
 * At this scaffold milestone the module only wires global configuration; the
 * streaming decorators (`@AiStream`, `@AiAbortSignal`, `@AiContext`) land in
 * later milestones and will read from these options.
 */
export interface AiModuleOptions {
  /**
   * Whether to register this module globally so the configuration is available
   * to every feature module without re-importing.
   *
   * @default true
   */
  isGlobal?: boolean;

  /**
   * Default headers applied to streaming responses produced by `@AiStream`.
   */
  defaultHeaders?: Record<string, string>;
}

/**
 * Configuration for {@link AiModule.forRootAsync}.
 */
export interface AiModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  /**
   * Whether to register this module globally.
   *
   * @default true
   */
  isGlobal?: boolean;

  /**
   * Providers to inject into {@link AiModuleAsyncOptions.useFactory}.
   */
  inject?: any[];

  /**
   * Additional providers registered alongside the resolved options.
   */
  extraProviders?: Provider[];

  /**
   * Factory that resolves the {@link AiModuleOptions} asynchronously.
   */
  useFactory: (
    ...args: any[]
  ) => AiModuleOptions | Promise<AiModuleOptions>;
}
