import type { SynthesisResult } from '@interview-sdk/core';

function writeString(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
}

/** A short sine-wave tone encoded as a real WAV file — no network, no API key. */
function encodeWavBeep(frequency = 880, durationSeconds = 0.25, sampleRate = 8000): ArrayBuffer {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const fadeOut = 1 - i / numSamples; // avoids an audible click at the end
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * fadeOut;
    view.setInt16(44 + i * 2, sample * 0x7fff, true);
  }

  return buffer;
}

/**
 * Stands in for a real adapter's synthesize() (e.g.
 * @interview-sdk/adapter-elevenlabs) — plays a short tone instead of real
 * speech, purely to exercise QuestionAudio's autoplay/replay/loading
 * plumbing in this demo without an API key.
 */
export async function mockSynthesize(_text: string): Promise<SynthesisResult> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { audio: encodeWavBeep(), mimeType: 'audio/wav' };
}

/**
 * Stands in for a real adapter's transcribe() — real speech-to-text needs a
 * provider key, so this always returns the same placeholder regardless of
 * what was actually said, purely to exercise MicButton's record/stop
 * plumbing end-to-end in this demo.
 */
export async function mockTranscribe(_audio: Blob): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  return 'This is a mock transcript — connect a real adapter for actual speech-to-text.';
}
