import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSpeechLevelMeter } from './useSpeechLevelMeter.js';

// jsdom has no real AudioContext implementation, so only the
// feature-detection/no-throw/cleanup paths are exercisable here. The actual
// amplitude math is covered in audio-level-math.test.ts.
describe('useSpeechLevelMeter', () => {
  it('reports unsupported and returns idle zeroed levels when AudioContext is unavailable', () => {
    const buffer = new ArrayBuffer(8);
    const { result } = renderHook(() => useSpeechLevelMeter(null, buffer, true));
    expect(result.current.isSupported).toBe(false);
    expect(result.current.levels.every((level) => level === 0)).toBe(true);
  });

  it('does not throw with no audio element, no raw audio, or while not playing', () => {
    expect(() => renderHook(() => useSpeechLevelMeter(null, null, false))).not.toThrow();
  });

  it('cleans up without throwing on unmount', () => {
    const buffer = new ArrayBuffer(8);
    const { unmount } = renderHook(() => useSpeechLevelMeter(null, buffer, true));
    expect(() => unmount()).not.toThrow();
  });

  it('re-runs decode when the raw audio reference changes', () => {
    const { rerender } = renderHook(({ audio }) => useSpeechLevelMeter(null, audio, false), {
      initialProps: { audio: new ArrayBuffer(8) as ArrayBuffer | null },
    });
    expect(() => rerender({ audio: new ArrayBuffer(16) })).not.toThrow();
  });
});
