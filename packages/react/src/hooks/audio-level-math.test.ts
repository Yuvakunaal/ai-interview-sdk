import { describe, expect, it } from 'vitest';
import { bytesToLevels, computeEnvelope, sampleEnvelope } from './audio-level-math.js';

describe('computeEnvelope', () => {
  it('buckets channel data into the requested count, normalized to a 0..1 peak', () => {
    const data = new Float32Array([0, 0, 0.2, 0.2, 1, 1, 0.1, 0.1]);
    const envelope = computeEnvelope(data, 4);

    expect(envelope).toHaveLength(4);
    expect(envelope[2]).toBeCloseTo(1, 5); // the loudest bucket hits peak normalization
    expect(Math.max(...envelope)).toBeCloseTo(1, 5);
  });

  it('returns an empty array for zero bucketCount or empty input', () => {
    expect(computeEnvelope(new Float32Array([1, 2, 3]), 0)).toEqual([]);
    expect(computeEnvelope(new Float32Array([]), 4)).toEqual([]);
  });

  it('never divides by zero when every sample is silent', () => {
    const envelope = computeEnvelope(new Float32Array([0, 0, 0, 0]), 2);
    expect(envelope).toEqual([0, 0]);
  });
});

describe('sampleEnvelope', () => {
  const envelope = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

  it('centers a window of barCount values around the given progress', () => {
    // progress 0.5 over 10 samples (indices 0-9) rounds to center index 5;
    // a window of 3 centered there covers indices 4-6.
    const bars = sampleEnvelope(envelope, 0.5, 3);
    expect(bars).toHaveLength(3);
    expect(bars).toEqual([envelope[4], envelope[5], envelope[6]]);
  });

  it('pads with zeros when the window runs off the start', () => {
    const bars = sampleEnvelope(envelope, 0, 3);
    expect(bars[0]).toBe(0);
  });

  it('pads with zeros when the window runs off the end', () => {
    const bars = sampleEnvelope(envelope, 1, 3);
    expect(bars.at(-1)).toBe(0);
  });

  it('returns zeros for an empty envelope', () => {
    expect(sampleEnvelope([], 0.5, 4)).toEqual([0, 0, 0, 0]);
  });
});

describe('bytesToLevels', () => {
  it('averages raw byte data into normalized 0..1 bars', () => {
    const data = new Uint8Array([255, 255, 0, 0]);
    const levels = bytesToLevels(data, 2);
    expect(levels).toEqual([1, 0]);
  });

  it('returns an empty array for zero barCount or empty input', () => {
    expect(bytesToLevels(new Uint8Array([1, 2, 3]), 0)).toEqual([]);
    expect(bytesToLevels(new Uint8Array([]), 4)).toEqual([]);
  });
});
