import {
  ElevenLabsError,
  ElevenLabsTimeoutError,
  type ElevenLabsClient,
} from '@elevenlabs/elevenlabs-js';
import {
  ProviderAuthError,
  ProviderConnectionError,
  ProviderInvalidRequestError,
  ProviderOverloadedError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from '@interview-sdk/core';
import { describe, expect, it, vi } from 'vitest';
import { createElevenLabsAdapter, ElevenLabsAdapter } from './index.js';

function streamOf(...chunks: number[][]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new Uint8Array(chunk));
      }
      controller.close();
    },
  });
}

function fakeClient(overrides: {
  convert?: (voiceId: string, params: unknown) => Promise<unknown>;
  sttConvert?: (params: unknown) => Promise<unknown>;
}): ElevenLabsClient {
  return {
    textToSpeech: { convert: overrides.convert ?? vi.fn() },
    speechToText: { convert: overrides.sttConvert ?? vi.fn() },
  } as unknown as ElevenLabsClient;
}

const audio = new Uint8Array([1, 2, 3]);

describe('ElevenLabsAdapter', () => {
  it('has id "elevenlabs"', () => {
    const adapter = new ElevenLabsAdapter({ client: fakeClient({}) });
    expect(adapter.id).toBe('elevenlabs');
  });

  describe('synthesize', () => {
    it('drains the response stream into a single ArrayBuffer', async () => {
      const convert = vi.fn(async (_voiceId: string, _params: unknown) =>
        streamOf([1, 2], [3, 4, 5]),
      );
      const adapter = new ElevenLabsAdapter({ client: fakeClient({ convert }) });

      const result = await adapter.synthesize('Hello there');

      expect(new Uint8Array(result.audio)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
      expect(result.mimeType).toBe('audio/mpeg');
    });

    it('releases the stream reader lock instead of leaking it when a read fails mid-stream', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]));
          controller.error(new Error('connection dropped'));
        },
      });
      const convert = vi.fn(async (_voiceId: string, _params: unknown) => stream);
      const adapter = new ElevenLabsAdapter({ client: fakeClient({ convert }) });

      await expect(adapter.synthesize('Hello there')).rejects.toThrow('connection dropped');
      expect(stream.locked).toBe(false);
    });

    it('passes the default voice id and model to the SDK', async () => {
      const convert = vi.fn(async (_voiceId: string, _params: unknown) => streamOf([]));
      const adapter = new ElevenLabsAdapter({ client: fakeClient({ convert }) });

      await adapter.synthesize('Hello there');

      expect(convert).toHaveBeenCalledWith('21m00Tcm4TlvDq8ikWAM', {
        text: 'Hello there',
        modelId: 'eleven_multilingual_v2',
        outputFormat: 'mp3_44100_128',
      });
    });

    it('allows overriding the voice id and model', async () => {
      const convert = vi.fn(async (_voiceId: string, _params: unknown) => streamOf([]));
      const adapter = new ElevenLabsAdapter({
        client: fakeClient({ convert }),
        voiceId: 'JBFqnCBsd6RMkjVDRZzb',
        speakModel: 'eleven_flash_v2_5',
      });

      await adapter.synthesize('Hello there');

      const [voiceId, params] = convert.mock.calls[0]!;
      expect(voiceId).toBe('JBFqnCBsd6RMkjVDRZzb');
      expect((params as { modelId: string }).modelId).toBe('eleven_flash_v2_5');
    });

    it('normalizes an auth error', async () => {
      const convert = vi.fn(async (_voiceId: string, _params: unknown) => {
        throw new ElevenLabsError({ message: 'invalid key', statusCode: 401 });
      });
      const adapter = new ElevenLabsAdapter({ client: fakeClient({ convert }) });

      await expect(adapter.synthesize('Hello there')).rejects.toThrow(ProviderAuthError);
    });
  });

  describe('transcribe', () => {
    it('returns the transcript text from a chunk response', async () => {
      const sttConvert = vi.fn(async (_params: unknown) => ({
        languageCode: 'eng',
        languageProbability: 0.98,
        text: 'a hash map uses buckets',
        words: [],
      }));
      const adapter = new ElevenLabsAdapter({ client: fakeClient({ sttConvert }) });

      const result = await adapter.transcribe(audio);

      expect(result.text).toBe('a hash map uses buckets');
    });

    it('passes the raw audio bytes and default model to the SDK', async () => {
      const sttConvert = vi.fn(async (_params: unknown) => ({ text: 'ok' }));
      const adapter = new ElevenLabsAdapter({ client: fakeClient({ sttConvert }) });

      await adapter.transcribe(audio);

      expect(sttConvert).toHaveBeenCalledWith({ file: audio, modelId: 'scribe_v2' });
    });

    it('allows overriding the transcription model', async () => {
      const sttConvert = vi.fn(async (_params: unknown) => ({ text: 'ok' }));
      const adapter = new ElevenLabsAdapter({
        client: fakeClient({ sttConvert }),
        transcribeModel: 'scribe_v1',
      });

      await adapter.transcribe(audio);

      expect(sttConvert).toHaveBeenCalledWith({ file: audio, modelId: 'scribe_v1' });
    });

    it('throws ProviderInvalidRequestError for a webhook/multichannel response with no text field', async () => {
      const sttConvert = vi.fn(async (_params: unknown) => ({
        message: 'queued',
        requestId: 'req_1',
      }));
      const adapter = new ElevenLabsAdapter({ client: fakeClient({ sttConvert }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow(ProviderInvalidRequestError);
    });

    it('normalizes a rate-limit error', async () => {
      const sttConvert = vi.fn(async (_params: unknown) => {
        throw new ElevenLabsError({ message: 'rate limited', statusCode: 429 });
      });
      const adapter = new ElevenLabsAdapter({ client: fakeClient({ sttConvert }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow(ProviderRateLimitError);
    });

    it("carries the provider's real Retry-After header into retryAfterMs, instead of discarding it", async () => {
      const sttConvert = vi.fn(async (_params: unknown) => {
        throw new ElevenLabsError({
          message: 'rate limited',
          statusCode: 429,
          rawResponse: { headers: new Headers({ 'retry-after': '30' }) } as never,
        });
      });
      const adapter = new ElevenLabsAdapter({ client: fakeClient({ sttConvert }) });

      await expect(adapter.transcribe(audio)).rejects.toMatchObject({ retryAfterMs: 30_000 });
    });

    it('normalizes a 5xx as an overloaded error', async () => {
      const sttConvert = vi.fn(async (_params: unknown) => {
        throw new ElevenLabsError({ message: 'server error', statusCode: 503 });
      });
      const adapter = new ElevenLabsAdapter({ client: fakeClient({ sttConvert }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow(ProviderOverloadedError);
    });

    it('normalizes a plain 400 as an invalid-request error', async () => {
      const sttConvert = vi.fn(async (_params: unknown) => {
        throw new ElevenLabsError({ message: 'bad request', statusCode: 400 });
      });
      const adapter = new ElevenLabsAdapter({ client: fakeClient({ sttConvert }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow(ProviderInvalidRequestError);
    });

    it("normalizes the SDK's own timeout error as a provider timeout error", async () => {
      // The Fern-generated ElevenLabs SDK throws this distinct class on a
      // request timeout — never wrapped in ElevenLabsError — so it must be
      // checked separately from the statusCode-based branches below.
      const sttConvert = vi.fn(async (_params: unknown) => {
        throw new ElevenLabsTimeoutError('Timeout exceeded when calling POST /v1/speech-to-text.');
      });
      const adapter = new ElevenLabsAdapter({ client: fakeClient({ sttConvert }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow(ProviderTimeoutError);
    });

    it('normalizes a raw connection failure (ElevenLabsError with no statusCode) as a connection error', async () => {
      // A genuine network failure (not an HTTP error response) is still
      // wrapped in ElevenLabsError by the SDK, but with no statusCode — the
      // existing status-based branches all fall through, so this used to
      // land on the generic ProviderInvalidRequestError, mischaracterizing
      // a transient network issue as a bad request.
      const sttConvert = vi.fn(async (_params: unknown) => {
        throw new ElevenLabsError({ message: 'fetch failed' });
      });
      const adapter = new ElevenLabsAdapter({ client: fakeClient({ sttConvert }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow(ProviderConnectionError);
    });

    it('passes through a non-ElevenLabs error unchanged', async () => {
      const sttConvert = vi.fn(async (_params: unknown) => {
        throw new Error('something else entirely');
      });
      const adapter = new ElevenLabsAdapter({ client: fakeClient({ sttConvert }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow('something else entirely');
    });
  });
});

describe('createElevenLabsAdapter', () => {
  it('constructs an ElevenLabsAdapter instance', () => {
    const adapter = createElevenLabsAdapter({ client: fakeClient({}) });
    expect(adapter).toBeInstanceOf(ElevenLabsAdapter);
    expect(adapter.id).toBe('elevenlabs');
  });
});
