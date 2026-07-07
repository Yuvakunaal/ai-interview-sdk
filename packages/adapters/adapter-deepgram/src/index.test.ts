import { DeepgramError, DeepgramTimeoutError, type DeepgramClient } from '@deepgram/sdk';
import {
  ProviderAuthError,
  ProviderConnectionError,
  ProviderInvalidRequestError,
  ProviderOverloadedError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from '@interview-sdk/core';
import { describe, expect, it, vi } from 'vitest';
import { createDeepgramAdapter, DeepgramAdapter } from './index.js';

function fakeClient(overrides: {
  transcribeFile?: (audio: unknown, params: unknown) => Promise<unknown>;
  generate?: (params: unknown) => Promise<unknown>;
}): DeepgramClient {
  return {
    listen: { v1: { media: { transcribeFile: overrides.transcribeFile ?? vi.fn() } } },
    speak: { v1: { audio: { generate: overrides.generate ?? vi.fn() } } },
  } as unknown as DeepgramClient;
}

const audio = new Uint8Array([1, 2, 3]);

describe('DeepgramAdapter', () => {
  it('has id "deepgram"', () => {
    const adapter = new DeepgramAdapter({ client: fakeClient({}) });
    expect(adapter.id).toBe('deepgram');
  });

  describe('transcribe', () => {
    it('returns the transcript from the first channel/alternative', async () => {
      const transcribeFile = vi.fn(async (_audio: unknown, _params: unknown) => ({
        results: { channels: [{ alternatives: [{ transcript: 'a hash map uses buckets' }] }] },
      }));
      const adapter = new DeepgramAdapter({ client: fakeClient({ transcribeFile }) });

      const result = await adapter.transcribe(audio);

      expect(result.text).toBe('a hash map uses buckets');
    });

    it('passes the raw audio bytes and model to the SDK', async () => {
      const transcribeFile = vi.fn(async (_audio: unknown, _params: unknown) => ({
        results: { channels: [{ alternatives: [{ transcript: 'ok' }] }] },
      }));
      const adapter = new DeepgramAdapter({ client: fakeClient({ transcribeFile }) });

      await adapter.transcribe(audio);

      expect(transcribeFile).toHaveBeenCalledWith(audio, { model: 'nova-3', smart_format: true });
    });

    it('allows overriding the transcription model', async () => {
      const transcribeFile = vi.fn(async (_audio: unknown, _params: unknown) => ({
        results: { channels: [{ alternatives: [{ transcript: 'ok' }] }] },
      }));
      const adapter = new DeepgramAdapter({
        client: fakeClient({ transcribeFile }),
        transcribeModel: 'nova-2',
      });

      await adapter.transcribe(audio);

      expect(transcribeFile).toHaveBeenCalledWith(audio, { model: 'nova-2', smart_format: true });
    });

    it('throws ProviderInvalidRequestError for an async accepted-response (no results)', async () => {
      const transcribeFile = vi.fn(async (_audio: unknown, _params: unknown) => ({
        request_id: 'req_123',
      }));
      const adapter = new DeepgramAdapter({ client: fakeClient({ transcribeFile }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow(ProviderInvalidRequestError);
    });

    it('throws ProviderInvalidRequestError when no transcript is present', async () => {
      const transcribeFile = vi.fn(async (_audio: unknown, _params: unknown) => ({
        results: { channels: [{ alternatives: [{}] }] },
      }));
      const adapter = new DeepgramAdapter({ client: fakeClient({ transcribeFile }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow(ProviderInvalidRequestError);
    });

    it('returns an empty transcript as a legitimate result (silence/no speech detected), not an error', async () => {
      // A present-but-empty transcript ("" — silence detected) is a real,
      // valid outcome, distinct from the malformed-shape case above where
      // the transcript field is missing entirely. adapter-elevenlabs
      // already treats this the same way; this must be consistent across
      // voice adapters instead of one throwing and one succeeding for the
      // identical "candidate said nothing" condition.
      const transcribeFile = vi.fn(async (_audio: unknown, _params: unknown) => ({
        results: { channels: [{ alternatives: [{ transcript: '' }] }] },
      }));
      const adapter = new DeepgramAdapter({ client: fakeClient({ transcribeFile }) });

      const result = await adapter.transcribe(audio);
      expect(result.text).toBe('');
    });

    it('normalizes a 401 as an auth error', async () => {
      const transcribeFile = vi.fn(async (_audio: unknown, _params: unknown) => {
        throw new DeepgramError({ message: 'invalid key', statusCode: 401 });
      });
      const adapter = new DeepgramAdapter({ client: fakeClient({ transcribeFile }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow(ProviderAuthError);
    });

    it('normalizes a 429 as a rate-limit error', async () => {
      const transcribeFile = vi.fn(async (_audio: unknown, _params: unknown) => {
        throw new DeepgramError({ message: 'rate limited', statusCode: 429 });
      });
      const adapter = new DeepgramAdapter({ client: fakeClient({ transcribeFile }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow(ProviderRateLimitError);
    });

    it("carries the provider's real Retry-After header into retryAfterMs, instead of discarding it", async () => {
      const transcribeFile = vi.fn(async (_audio: unknown, _params: unknown) => {
        throw new DeepgramError({
          message: 'rate limited',
          statusCode: 429,
          rawResponse: { headers: new Headers({ 'retry-after': '30' }) } as never,
        });
      });
      const adapter = new DeepgramAdapter({ client: fakeClient({ transcribeFile }) });

      await expect(adapter.transcribe(audio)).rejects.toMatchObject({ retryAfterMs: 30_000 });
    });

    it('normalizes a 5xx as an overloaded error', async () => {
      const transcribeFile = vi.fn(async (_audio: unknown, _params: unknown) => {
        throw new DeepgramError({ message: 'server error', statusCode: 503 });
      });
      const adapter = new DeepgramAdapter({ client: fakeClient({ transcribeFile }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow(ProviderOverloadedError);
    });

    it('normalizes a plain 400 as an invalid-request error', async () => {
      const transcribeFile = vi.fn(async (_audio: unknown, _params: unknown) => {
        throw new DeepgramError({ message: 'bad request', statusCode: 400 });
      });
      const adapter = new DeepgramAdapter({ client: fakeClient({ transcribeFile }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow(ProviderInvalidRequestError);
    });

    it('normalizes the SDK\'s own timeout error as a provider timeout error', async () => {
      // The Fern-generated Deepgram SDK throws this distinct class on a
      // request timeout — never wrapped in DeepgramError — so it must be
      // checked separately, not assumed to be covered by the DeepgramError
      // branch below.
      const transcribeFile = vi.fn(async (_audio: unknown, _params: unknown) => {
        throw new DeepgramTimeoutError('Timeout exceeded when calling POST /v1/listen.');
      });
      const adapter = new DeepgramAdapter({ client: fakeClient({ transcribeFile }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow(ProviderTimeoutError);
    });

    it('normalizes a raw connection failure (DeepgramError with no statusCode) as a connection error', async () => {
      // A genuine network failure (not an HTTP error response) is still
      // wrapped in DeepgramError by the SDK, but with no statusCode — the
      // existing status-based branches all fall through, so this used to
      // land on the generic ProviderInvalidRequestError, mischaracterizing
      // a transient network issue as a bad request.
      const transcribeFile = vi.fn(async (_audio: unknown, _params: unknown) => {
        throw new DeepgramError({ message: 'fetch failed', cause: new Error('ECONNREFUSED') });
      });
      const adapter = new DeepgramAdapter({ client: fakeClient({ transcribeFile }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow(ProviderConnectionError);
    });

    it('passes through a non-Deepgram error unchanged', async () => {
      const transcribeFile = vi.fn(async (_audio: unknown, _params: unknown) => {
        throw new Error('something else entirely');
      });
      const adapter = new DeepgramAdapter({ client: fakeClient({ transcribeFile }) });

      await expect(adapter.transcribe(audio)).rejects.toThrow('something else entirely');
    });
  });

  describe('synthesize', () => {
    it('returns audio bytes and a wav mime type', async () => {
      const bytes = new Uint8Array([9, 9, 9]).buffer;
      const generate = vi.fn(async (_params: unknown) => ({ arrayBuffer: async () => bytes }));
      const adapter = new DeepgramAdapter({ client: fakeClient({ generate }) });

      const result = await adapter.synthesize('Hello there');

      expect(result.audio).toBe(bytes);
      expect(result.mimeType).toBe('audio/wav');
    });

    it('passes the text and default speak model to the SDK', async () => {
      const generate = vi.fn(async (_params: unknown) => ({
        arrayBuffer: async () => new ArrayBuffer(0),
      }));
      const adapter = new DeepgramAdapter({ client: fakeClient({ generate }) });

      await adapter.synthesize('Hello there');

      expect(generate).toHaveBeenCalledWith({
        text: 'Hello there',
        model: 'aura-2-thalia-en',
        container: 'wav',
        encoding: 'linear16',
      });
    });

    it('allows overriding the speak model', async () => {
      const generate = vi.fn(async (_params: unknown) => ({
        arrayBuffer: async () => new ArrayBuffer(0),
      }));
      const adapter = new DeepgramAdapter({
        client: fakeClient({ generate }),
        speakModel: 'aura-2-orion-en',
      });

      await adapter.synthesize('Hello there');

      expect((generate.mock.calls[0]![0] as { model: string }).model).toBe('aura-2-orion-en');
    });

    it('normalizes errors the same way as transcribe', async () => {
      const generate = vi.fn(async (_params: unknown) => {
        throw new DeepgramError({ message: 'invalid key', statusCode: 401 });
      });
      const adapter = new DeepgramAdapter({ client: fakeClient({ generate }) });

      await expect(adapter.synthesize('Hello there')).rejects.toThrow(ProviderAuthError);
    });
  });
});

describe('createDeepgramAdapter', () => {
  it('constructs a DeepgramAdapter instance', () => {
    const adapter = createDeepgramAdapter({ client: fakeClient({}) });
    expect(adapter).toBeInstanceOf(DeepgramAdapter);
    expect(adapter.id).toBe('deepgram');
  });
});
