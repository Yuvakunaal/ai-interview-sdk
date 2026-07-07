import { DeepgramClient, DeepgramError, DeepgramTimeoutError } from '@deepgram/sdk';
import {
  ProviderAuthError,
  ProviderConnectionError,
  ProviderInvalidRequestError,
  ProviderOverloadedError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  type SynthesisResult,
  type TranscriptResult,
  type VoiceProviderAdapter,
} from '@interview-sdk/core';

export interface DeepgramAdapterConfig {
  apiKey?: string;
  /**
   * Speech-to-text (transcription) model. Defaults to `nova-3`. Named to
   * mirror `@interview-sdk/adapter-elevenlabs`'s `transcribeModel` — on that
   * adapter, `model` means TTS instead, so this package deliberately never
   * has a bare `model` option to avoid the same name meaning opposite
   * things depending on which voice adapter you're configuring.
   */
  transcribeModel?: string;
  /** Speech-synthesis (TTS) model. Defaults to `aura-2-thalia-en`. */
  speakModel?: string;
  /** Inject a pre-configured client (e.g. for testing). */
  client?: DeepgramClient;
}

const DEFAULT_TRANSCRIBE_MODEL = 'nova-3';
const DEFAULT_SPEAK_MODEL = 'aura-2-thalia-en';

/** Parses a Retry-After header (seconds, or an HTTP date) into milliseconds. */
function parseRetryAfterMs(headers: Headers | undefined): number | undefined {
  const value = headers?.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : undefined;
}

export class DeepgramAdapter implements VoiceProviderAdapter {
  readonly id = 'deepgram';
  private readonly client: DeepgramClient;
  private readonly transcribeModel: string;
  private readonly speakModel: string;

  constructor(config: DeepgramAdapterConfig = {}) {
    this.client = config.client ?? new DeepgramClient({ apiKey: config.apiKey });
    this.transcribeModel = config.transcribeModel ?? DEFAULT_TRANSCRIBE_MODEL;
    this.speakModel = config.speakModel ?? DEFAULT_SPEAK_MODEL;
  }

  async transcribe(audio: ArrayBuffer | Uint8Array): Promise<TranscriptResult> {
    try {
      const response = await this.client.listen.v1.media.transcribeFile(audio, {
        model: this.transcribeModel,
        smart_format: true,
      });

      // We never pass `callback`, so Deepgram always responds synchronously
      // with a ListenV1Response (not the async ListenV1AcceptedResponse).
      if (!('results' in response)) {
        throw new ProviderInvalidRequestError(
          'Deepgram returned an asynchronous accepted-response instead of a transcript.',
          this.id,
        );
      }

      const transcript = response.results.channels[0]?.alternatives?.[0]?.transcript;
      // A present-but-empty transcript ("") is a real, legitimate result —
      // silence/no speech detected — not an error; only a genuinely missing
      // transcript field (a malformed/unexpected response shape) throws.
      // adapter-elevenlabs already treats an equivalent empty-text response
      // as success, so this must match rather than diverge for the same
      // "candidate said nothing" condition.
      if (typeof transcript !== 'string') {
        throw new ProviderInvalidRequestError(
          'Deepgram response contained no transcript.',
          this.id,
        );
      }

      return { text: transcript, raw: response };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async synthesize(text: string): Promise<SynthesisResult> {
    try {
      const response = await this.client.speak.v1.audio.generate({
        text,
        model: this.speakModel,
        container: 'wav',
        encoding: 'linear16',
      });

      const audio = await response.arrayBuffer();
      return { audio, mimeType: 'audio/wav', raw: response };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private normalizeError(error: unknown): Error {
    // Thrown as its own distinct class, never wrapped in DeepgramError.
    if (error instanceof DeepgramTimeoutError) {
      return new ProviderTimeoutError(error.message, this.id, { cause: error });
    }
    if (!(error instanceof DeepgramError)) {
      return error instanceof Error ? error : new Error(String(error));
    }

    const status = error.statusCode;
    if (status === 401 || status === 403) {
      return new ProviderAuthError(error.message, this.id, { cause: error });
    }
    if (status === 429) {
      return new ProviderRateLimitError(
        error.message,
        this.id,
        parseRetryAfterMs(error.rawResponse?.headers),
        { cause: error },
      );
    }
    if (status !== undefined && status >= 500) {
      return new ProviderOverloadedError(error.message, this.id, { cause: error });
    }
    if (status === undefined) {
      // A genuine network failure (not an HTTP error response) is still
      // wrapped in DeepgramError, but with no statusCode at all.
      return new ProviderConnectionError(error.message, this.id, { cause: error });
    }
    return new ProviderInvalidRequestError(error.message, this.id, { cause: error });
  }
}

export function createDeepgramAdapter(config?: DeepgramAdapterConfig): DeepgramAdapter {
  return new DeepgramAdapter(config);
}
