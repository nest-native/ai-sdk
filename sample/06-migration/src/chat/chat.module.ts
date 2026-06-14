import { Module } from '@nestjs/common';
import { LegacyChatController } from './legacy.controller';
import { MigratedChatController } from './migrated.controller';

/**
 * Registers both the BEFORE (`LegacyChatController`, raw `@Res()`) and AFTER
 * (`MigratedChatController`, `@AiStream`) controllers side by side so the smoke
 * test can hit the same recipes under `/legacy` and `/migrated` and prove the
 * migration is behaviour-preserving for the happy path while fixing pre-stream
 * error semantics. The mock model is constructed inline by each handler, so
 * there is no provider to register.
 */
@Module({
  controllers: [LegacyChatController, MigratedChatController],
})
export class ChatModule {}
