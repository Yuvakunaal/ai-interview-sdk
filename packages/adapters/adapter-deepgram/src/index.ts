import { DeepgramClient, DeepgramError } from '@deepgram/sdk';
import {
  ProviderAuthError,
  ProviderInvalidRequestError,
  ProviderOverloadedError,
  ProviderRateLimitError,
  type SynthesisResult,
  type TranscriptResult,
  type VoiceProviderAdapter,
} from '@interview-sdk/core';

export interface DeepgramAdapterConfig {
  apiKey?: string;
  /** Transcription model. Defaults to `nova-3`. */
  model?: string;
  /** Speech-synthesis (TTS) model. Defaults to `aura-2-thalia-en`. */
  speakModel?: string;
  /** Inject a pre-configured client (e.g. for testing). */
  client?: DeepgramClient;
}

const DEFAULT_TRANSCRIBE_MODEL = 'nova-3';
const DEFAULT_SPEAK_MODEL = 'aura-2-thalia-en';

export class DeepgramAdapter implements VoiceProviderAdapter {
  readonly id = 'deepgram';
  private readonly client: DeepgramClient;
  private readonly model: string;
  private readonly speakModel: string;

  constructor(config: DeepgramAdapterConfig = {}) {
    this.client = config.client ?? new DeepgramClient({ apiKey: config.apiKey });
    this.model = config.model ?? DEFAULT_TRANSCRIBE_MODEL;
    this.speakModel = config.speakModel ?? DEFAULT_SPEAK_MODEL;
  }

  async transcribe(audio: ArrayBuffer | Uint8Array): Promise<TranscriptResult> {
    try {
      const response = await this.client.listen.v1.media.transcribeFile(audio, {
        model: this.model,
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
      if (!transcript) {
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
    if (!(error instanceof DeepgramError)) {
      return error instanceof Error ? error : new Error(String(error));
    }

    const status = error.statusCode;
    if (status === 401 || status === 403) {
      return new ProviderAuthError(error.message, this.id, { cause: error });
    }
    if (status === 429) {
      return new ProviderRateLimitError(error.message, this.id, undefined, { cause: error });
    }
    if (status !== undefined && status >= 500) {
      return new ProviderOverloadedError(error.message, this.id, { cause: error });
    }
    return new ProviderInvalidRequestError(error.message, this.id, { cause: error });
  }
}

export function createDeepgramAdapter(config?: DeepgramAdapterConfig): DeepgramAdapter {
  return new DeepgramAdapter(config);
}
