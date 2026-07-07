import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMicLevelMeter } from './useMicLevelMeter.js';

// jsdom has no real AudioContext implementation, so only the
// feature-detection/no-throw/cleanup paths are exercisable here. The actual
// amplitude math is covered in audio-level-math.test.ts.
describe('useMicLevelMeter', () => {
  it('reports unsupported and returns idle zeroed levels when there is no stream', () => {
    const { result } = renderHook(() => useMicLevelMeter(null, true));
    expect(result.current.isSupported).toBe(false);
    expect(result.current.levels.every((level) => level === 0)).toBe(true);
  });

  it('reports unsupported when a stream exists but is not active', () => {
    const fakeStream = {} as MediaStream;
    const { result } = renderHook(() => useMicLevelMeter(fakeStream, false));
    expect(result.current.isSupported).toBe(false);
  });

  it('does not throw when AudioContext is unavailable even with an active real-shaped stream', () => {
    const fakeStream = {} as MediaStream;
    expect(() => renderHook(() => useMicLevelMeter(fakeStream, true))).not.toThrow();
  });

  it('cleans up without throwing on unmount', () => {
    const fakeStream = {} as MediaStream;
    const { unmount } = renderHook(() => useMicLevelMeter(fakeStream, true));
    expect(() => unmount()).not.toThrow();
  });

  it('does not throw when toggling active off then on', () => {
    const fakeStream = {} as MediaStream;
    const { rerender } = renderHook(({ active }) => useMicLevelMeter(fakeStream, active), {
      initialProps: { active: true },
    });
    expect(() => rerender({ active: false })).not.toThrow();
    expect(() => rerender({ active: true })).not.toThrow();
  });
});
