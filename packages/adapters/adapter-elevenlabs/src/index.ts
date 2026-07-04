import { ElevenLabsClient, ElevenLabsError } from '@elevenlabs/elevenlabs-js';
import {
  ProviderAuthError,
  ProviderInvalidRequestError,
  ProviderOverloadedError,
  ProviderRateLimitError,
  type SynthesisResult,
  type TranscriptResult,
  type VoiceProviderAdapter,
} from '@interview-sdk/core';

export interface ElevenLabsAdapterConfig {
  apiKey?: string;
  /** Voice to use for synthesis. Defaults to ElevenLabs' pre-built "Rachel" voice. */
  voiceId?: string;
  /** Text-to-speech model. Defaults to `eleven_multilingual_v2`. */
  model?: string;
  /** Speech-to-text model. Defaults to `scribe_v2`. */
  transcribeModel?: 'scribe_v1' | 'scribe_v2';
  /** Inject a pre-configured client (e.g. for testing). */
  client?: ElevenLabsClient;
}

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // "Rachel" — ElevenLabs' widely-used prebuilt default voice
const DEFAULT_TTS_MODEL = 'eleven_multilingual_v2';
const DEFAULT_STT_MODEL = 'scribe_v2';

async function drainStream(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged.buffer as ArrayBuffer;
}

export class ElevenLabsAdapter implements VoiceProviderAdapter {
  readonly id = 'elevenlabs';
  private readonly client: ElevenLabsClient;
  private readonly voiceId: string;
  private readonly model: string;
  private readonly transcribeModel: 'scribe_v1' | 'scribe_v2';

  constructor(config: ElevenLabsAdapterConfig = {}) {
    this.client = config.client ?? new ElevenLabsClient({ apiKey: config.apiKey });
    this.voiceId = config.voiceId ?? DEFAULT_VOICE_ID;
    this.model = config.model ?? DEFAULT_TTS_MODEL;
    this.transcribeModel = config.transcribeModel ?? DEFAULT_STT_MODEL;
  }

  async synthesize(text: string): Promise<SynthesisResult> {
    try {
      const stream = await this.client.textToSpeech.convert(this.voiceId, {
        text,
        modelId: this.model,
        outputFormat: 'mp3_44100_128',
      });

      const audio = await drainStream(stream);
      return { audio, mimeType: 'audio/mpeg', raw: stream };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async transcribe(audio: ArrayBuffer | Uint8Array): Promise<TranscriptResult> {
    try {
      const response = await this.client.speechToText.convert({
        file: audio,
        modelId: this.transcribeModel,
      });

      // We never pass a webhook, and don't request multichannel handling, so
      // the sync SpeechToTextChunkResponseModel (the only variant with a
      // `text` field) is the only shape we expect back.
      if (!('text' in response)) {
        throw new ProviderInvalidRequestError(
          'ElevenLabs returned a webhook/multichannel response instead of a transcript.',
          this.id,
        );
      }

      return { text: response.text, raw: response };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private normalizeError(error: unknown): Error {
    if (!(error instanceof ElevenLabsError)) {
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

export function createElevenLabsAdapter(config?: ElevenLabsAdapterConfig): ElevenLabsAdapter {
  return new ElevenLabsAdapter(config);
}
