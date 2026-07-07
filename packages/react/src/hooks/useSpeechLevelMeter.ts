import { useEffect, useRef, useState } from 'react';
import { computeEnvelope, sampleEnvelope } from './audio-level-math.js';
import { getAudioContextCtor } from './web-audio-support.js';

export interface UseSpeechLevelMeterResult {
  levels: number[];
  isSupported: boolean;
}

const BAR_COUNT = 5;
const ENVELOPE_BUCKETS = 200;
const SAMPLE_INTERVAL_MS = 60; // ~16 updates/sec — plenty smooth, cheap enough to re-render on

function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data.slice(0);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

/**
 * Drives a live-feeling amplitude meter for synthesized speech WITHOUT ever
 * routing the <audio> element through a live AnalyserNode. A freshly
 * created AudioContext starts 'suspended' until a user gesture resumes it
 * — exactly the autoplay case this widget already has to handle — so if
 * the element's output were re-routed through a suspended context's graph,
 * playback would go silent with no error while `ended` still fires
 * normally. That would regress already-working audio behind an invisible
 * bug. Instead: decode the already-in-memory TTS bytes into an amplitude
 * envelope once, offline, and sample it against the real element's own
 * currentTime/duration during real playback. The element's native output
 * is never touched.
 *
 * Only the feature-detection/no-throw/cleanup paths are exercisable under
 * jsdom (no real AudioContext or audio decoding exists there) — the
 * amplitude math itself is covered in audio-level-math.test.ts.
 */
export function useSpeechLevelMeter(
  audioEl: HTMLAudioElement | null,
  rawAudio: ArrayBuffer | Uint8Array | null,
  isPlaying: boolean,
): UseSpeechLevelMeterResult {
  const [levels, setLevels] = useState<number[]>(() => new Array(BAR_COUNT).fill(0));
  const [isSupported, setIsSupported] = useState(false);
  const envelopeRef = useRef<number[] | null>(null);

  // One instance of this hook lives for one QuestionAudio mount, which
  // itself remounts fresh per prompt (key={prompt} on the caller) — so
  // `rawAudio` only ever transitions null -> populated once per mount,
  // never back again, and the initial useState values above already cover
  // the "nothing decoded yet" case with no reset needed here.
  useEffect(() => {
    const Ctor = getAudioContextCtor();
    if (!Ctor || !rawAudio) return;

    let cancelled = false;
    const ctx = new Ctor();

    ctx
      .decodeAudioData(toArrayBuffer(rawAudio))
      .then((buffer) => {
        if (cancelled) return;
        envelopeRef.current = computeEnvelope(buffer.getChannelData(0), ENVELOPE_BUCKETS);
        setIsSupported(true);
      })
      .catch(() => {
        // A decode failure only degrades the visualization to idle — it is
        // never reported as a voice error; the question audio itself
        // (already decoded natively by the <audio> element) is unaffected.
      })
      .finally(() => {
        if (ctx.state !== 'closed') void ctx.close().catch(() => {});
      });

    return () => {
      cancelled = true;
    };
  }, [rawAudio]);

  useEffect(() => {
    if (!isPlaying || !audioEl || !isSupported) return;

    let frame: number;
    let lastSample = 0;

    const tick = (time: number) => {
      if (time - lastSample >= SAMPLE_INTERVAL_MS && envelopeRef.current) {
        lastSample = time;
        const duration = audioEl.duration;
        const progress = duration > 0 ? audioEl.currentTime / duration : 0;
        setLevels(sampleEnvelope(envelopeRef.current, progress, BAR_COUNT));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [isPlaying, audioEl, isSupported]);

  return { levels, isSupported };
}
