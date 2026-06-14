import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AI_MODULE_OPTIONS, AiModule } from '../ai.module';
import { AiModuleOptions } from '../interfaces';

@Injectable()
class MarkerProvider {
  readonly name = 'marker';
}

describe('AiModule', () => {
  it('provides default options when forRoot is called without arguments', async () => {
    const module = await Test.createTestingModule({
      imports: [AiModule.forRoot()],
    }).compile();

    assert.deepEqual(module.get<AiModuleOptions>(AI_MODULE_OPTIONS), {});
  });

  it('provides the supplied options through forRoot', async () => {
    const options: AiModuleOptions = {
      defaultHeaders: { 'x-ai': 'on' },
    };

    const module = await Test.createTestingModule({
      imports: [AiModule.forRoot(options)],
    }).compile();

    assert.equal(module.get<AiModuleOptions>(AI_MODULE_OPTIONS), options);
  });

  it('is global by default and allows explicit opt-out via forRoot', () => {
    assert.equal(AiModule.forRoot().global, true);
    assert.equal(AiModule.forRoot({ isGlobal: true }).global, true);
    assert.equal(AiModule.forRoot({ isGlobal: false }).global, false);
  });

  it('resolves options through forRootAsync useFactory', async () => {
    const options: AiModuleOptions = {
      defaultHeaders: { 'x-ai': 'async' },
    };

    const module = await Test.createTestingModule({
      imports: [
        AiModule.forRootAsync({
          useFactory: async () => options,
        }),
      ],
    }).compile();

    assert.equal(module.get<AiModuleOptions>(AI_MODULE_OPTIONS), options);
  });

  it('injects dependencies and registers extra providers in forRootAsync', async () => {
    const module = await Test.createTestingModule({
      imports: [
        AiModule.forRootAsync({
          imports: [],
          inject: [MarkerProvider],
          extraProviders: [MarkerProvider],
          useFactory: (marker: MarkerProvider) => ({
            defaultHeaders: { 'x-marker': marker.name },
          }),
        }),
      ],
    }).compile();

    assert.deepEqual(module.get<AiModuleOptions>(AI_MODULE_OPTIONS), {
      defaultHeaders: { 'x-marker': 'marker' },
    });
    assert.equal(module.get(MarkerProvider).name, 'marker');
  });

  it('is global by default and allows explicit opt-out via forRootAsync', () => {
    const defaulted = AiModule.forRootAsync({
      useFactory: () => ({}),
    });
    const explicitTrue = AiModule.forRootAsync({
      isGlobal: true,
      useFactory: () => ({}),
    });
    const explicitFalse = AiModule.forRootAsync({
      isGlobal: false,
      useFactory: () => ({}),
    });

    assert.equal(defaulted.global, true);
    assert.deepEqual(defaulted.imports, []);
    assert.equal(explicitTrue.global, true);
    assert.equal(explicitFalse.global, false);
  });
});
