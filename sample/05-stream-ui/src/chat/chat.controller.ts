import { AiStream } from '@nest-native/ai-sdk';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { createUIMessageStream } from 'ai';
import { toUiMessageStreamResult } from './ui-stream-result';
import {
  WeatherCard,
  WeatherRequest,
  weatherRequestSchema,
} from './ui.schema';
import { ApiKeyGuard } from '../common/api-key.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * A deterministic, offline "model" for the weather card. A real provider would
 * produce this from a tool call; keeping it fixed keeps the sample offline and
 * its smoke test exact.
 */
function forecast(city: string): WeatherCard {
  return { city, temperatureC: 21, condition: 'Partly cloudy' };
}

/**
 * The v5 generative-UI equivalent of the removed RSC `streamUI`.
 *
 * v5 dropped `ai/rsc`'s `streamUI` (which streamed React nodes). The supported
 * replacement is the UI message stream with **custom data parts**: the server
 * writes `data-*` parts via `createUIMessageStream`, and the client renders each
 * one with its own component (here a `<WeatherCard />` keyed off `data-weather`).
 *
 * `createUIMessageStream` returns a bare `ReadableStream`, which `@AiStream` does
 * not serialize directly — so the handler adapts it with the local
 * `toUiMessageStreamResult` wrapper. The decorator then serves it exactly like a
 * `streamText` result, with the full enhancer pipeline (guard + pipe) running
 * before the first byte.
 */
@UseGuards(ApiKeyGuard)
@Controller('weather')
export class ChatController {
  @Post()
  @AiStream()
  generate(
    @Body(new ZodValidationPipe(weatherRequestSchema)) body: WeatherRequest,
  ) {
    const card = forecast(body.city);
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: 'start' });
        writer.write({ type: 'text-start', id: '1' });
        writer.write({
          type: 'text-delta',
          id: '1',
          delta: `Here is the forecast for ${card.city}: `,
        });
        writer.write({ type: 'text-end', id: '1' });
        // The custom data part — the generative-UI payload the client renders
        // with a dedicated component, replacing RSC `streamUI`'s React nodes.
        writer.write({ type: 'data-weather', id: 'weather-1', data: card });
      },
    });

    return toUiMessageStreamResult(stream);
  }
}
