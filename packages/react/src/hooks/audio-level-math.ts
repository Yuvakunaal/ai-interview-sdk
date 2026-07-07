/**
 * Pure amplitude math shared by the AI-speaking meter (offline envelope of
 * decoded TTS audio) and the candidate-mic meter (live analyser bytes). No
 * DOM/Web Audio types here on purpose — fully unit-testable without a
 * browser.
 */

/** Average magnitude of `channelData` bucketed into `bucketCount` values, each normalized to roughly 0..1. */
export function computeEnvelope(channelData: Float32Array, bucketCount: number): number[] {
  if (bucketCount <= 0 || channelData.length === 0) return [];

  const bucketSize = Math.max(1, Math.floor(channelData.length / bucketCount));
  const envelope: number[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const start = i * bucketSize;
    const end = i === bucketCount - 1 ? channelData.length : start + bucketSize;
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < channelData.length; j++) {
      sum += Math.abs(channelData[j]!);
      count++;
    }
    envelope.push(count > 0 ? sum / count : 0);
  }

  const peak = Math.max(...envelope, 1e-6);
  return envelope.map((value) => Math.min(1, value / peak));
}

/** Windowed snapshot of `barCount` envelope values centered around normalized playback `progress` (0..1). */
export function sampleEnvelope(envelope: number[], progress: number, barCount: number): number[] {
  if (envelope.length === 0 || barCount <= 0) return new Array(Math.max(0, barCount)).fill(0);

  const center = Math.round(Math.min(1, Math.max(0, progress)) * (envelope.length - 1));
  const half = Math.floor(barCount / 2);

  return Array.from({ length: barCount }, (_, i) => {
    const index = center - half + i;
    return index >= 0 && index < envelope.length ? envelope[index]! : 0;
  });
}

/** Buckets raw analyser byte data (0-255) into `barCount` normalized 0..1 averages. */
export function bytesToLevels(data: Uint8Array, barCount: number): number[] {
  if (barCount <= 0 || data.length === 0) return [];

  const bucketSize = Math.max(1, Math.floor(data.length / barCount));
  const levels: number[] = [];

  for (let i = 0; i < barCount; i++) {
    const start = i * bucketSize;
    const end = i === barCount - 1 ? data.length : start + bucketSize;
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < data.length; j++) {
      sum += data[j]!;
      count++;
    }
    levels.push(count > 0 ? sum / count / 255 : 0);
  }

  return levels;
}
