import { useEffect, useState } from 'react';
import { bytesToLevels } from './audio-level-math.js';
import { getAudioContextCtor } from './web-audio-support.js';

export interface UseMicLevelMeterResult {
  levels: number[];
  isSupported: boolean;
}

const BAR_COUNT = 5;
const SAMPLE_INTERVAL_MS = 60;

/**
 * Live amplitude meter for the candidate's own mic input, sourced from the
 * SAME MediaStream already feeding MediaRecorder — never a second
 * getUserMedia() request. The analyser graph terminates at the
 * AnalyserNode and is never connected onward to `ctx.destination`, so the
 * candidate's own voice is never routed back to their speakers.
 *
 * Only the feature-detection/no-throw/cleanup paths are exercisable under
 * jsdom (no real AudioContext exists there); the amplitude math itself is
 * covered in audio-level-math.test.ts.
 */
export function useMicLevelMeter(stream: MediaStream | null, active: boolean): UseMicLevelMeterResult {
  const [levels, setLevels] = useState<number[]>(() => new Array(BAR_COUNT).fill(0));
  const [isSupported, setIsSupported] = useState(false);

  // Only rendered while actively recording (see MicButton), so there is no
  // window in which a stale value from a previous recording bout would be
  // visible — no reset needed when this re-runs for a new stream/session.
  useEffect(() => {
    const Ctor = getAudioContextCtor();
    if (!Ctor || !stream || !active) return;

    let frame: number;
    let ctx: AudioContext;
    let analyser: AnalyserNode;
    let source: MediaStreamAudioSourceNode;

    try {
      ctx = new Ctor();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source = ctx.createMediaStreamSource(stream);
      source.connect(analyser); // deliberately not connected onward to ctx.destination — no feedback
    } catch {
      return;
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    let lastSample = 0;
    let hasMarkedSupported = false;

    const tick = (time: number) => {
      // Deferred to the first real tick (not called synchronously in the
      // effect body) — an AudioContext existing doesn't guarantee data ever
      // actually flows; this marks "supported" only once it demonstrably does.
      if (!hasMarkedSupported) {
        hasMarkedSupported = true;
        setIsSupported(true);
      }
      if (time - lastSample >= SAMPLE_INTERVAL_MS) {
        lastSample = time;
        analyser.getByteFrequencyData(data);
        setLevels(bytesToLevels(data, BAR_COUNT));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      analyser.disconnect();
      if (ctx.state !== 'closed') void ctx.close().catch(() => {});
    };
  }, [stream, active]);

  return { levels, isSupported };
}
