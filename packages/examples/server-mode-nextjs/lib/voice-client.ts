import type { SynthesisResult } from '@interview-sdk/core';

/**
 * Real synthesize() for <InterviewWidget> — POSTs to this app's own
 * /api/voice/synthesize route (real ElevenLabsAdapter, server-side only)
 * rather than calling ElevenLabs directly, so the API key never reaches
 * the browser.
 */
export async function synthesizeViaApi(text: string): Promise<SynthesisResult> {
  const response = await fetch('/api/voice/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new Error(`Voice synthesis failed: ${response.status} ${await response.text()}`);
  }
  const audio = await response.arrayBuffer();
  const mimeType = response.headers.get('Content-Type') ?? 'audio/mpeg';
  return { audio, mimeType };
}

/** Real transcribe() for <InterviewWidget> — same server-side-key pattern as above. */
export async function transcribeViaApi(audio: Blob): Promise<string> {
  const response = await fetch('/api/voice/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: audio,
  });
  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.status} ${await response.text()}`);
  }
  const { text } = (await response.json()) as { text: string };
  return text;
}
