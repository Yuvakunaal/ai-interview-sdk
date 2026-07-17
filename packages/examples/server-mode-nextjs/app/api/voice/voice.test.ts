import { describe, expect, it } from 'vitest';
import { POST as synthesize } from './synthesize/route.js';
import { POST as transcribe } from './transcribe/route.js';

/**
 * Same "zero setup" guarantee as the interview/answer route (see its
 * route.test.ts) — these two proxy routes previously required a real
 * ELEVENLABS_API_KEY and threw otherwise, contradicting the mock-voice
 * default every doc describes.
 */
describe('POST /api/voice/synthesize', () => {
  it('returns audio with zero environment variables set', async () => {
    expect(process.env.ELEVENLABS_API_KEY).toBeUndefined();

    const request = new Request('http://localhost/api/voice/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'What is a SELECT statement?' }),
    });

    const response = await synthesize(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/wav');
    const audio = await response.arrayBuffer();
    expect(audio.byteLength).toBeGreaterThan(0);
  });
});

describe('POST /api/voice/transcribe', () => {
  it('returns a transcript with zero environment variables set', async () => {
    expect(process.env.ELEVENLABS_API_KEY).toBeUndefined();

    const request = new Request('http://localhost/api/voice/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array([0, 1, 2, 3]),
    });

    const response = await transcribe(request);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { text: string };
    expect(typeof body.text).toBe('string');
    expect(body.text.length).toBeGreaterThan(0);
  });
});
