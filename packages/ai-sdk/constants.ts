/**
 * Reflect metadata key that marks a handler as an AI SDK streaming route and
 * carries its resolved {@link AiStreamOptions}.
 *
 * The {@link AiStream} decorator writes this metadata and the
 * `AiStreamInterceptor` reads it back to decide how to serialize the handler's
 * stream result onto the HTTP response.
 */
export const AI_STREAM_METADATA = 'nest-native:ai-sdk:stream';
