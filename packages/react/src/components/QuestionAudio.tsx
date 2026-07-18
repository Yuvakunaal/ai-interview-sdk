import type { SynthesisResult } from '@interview-sdk/core';
import { useEffect, useState } from 'react';
import { AudioLevelMeter } from './AudioLevelMeter.js';
import { useSpeechLevelMeter } from '../hooks/useSpeechLevelMeter.js';

export interface QuestionAudioProps {
  /** The prompt text to speak — re-synthesized whenever this changes. */
  text: string;
  /** Turns text into speech — typically a VoiceProviderAdapter's synthesize(). */
  synthesize: (text: string) => Promise<SynthesisResult>;
  /**
   * Called when synthesis fails or playback is unavailable. The question
   * text is always visible in QuestionCard regardless — this is a bonus
   * audio channel, never the only way to get the question.
   */
  onError?: (error: Error) => void;
  /** Attempts to play as soon as audio is ready. Defaults to true. */
  autoPlay?: boolean;
  /** Fires on the <audio> element's real 'play' event — turn-state signal for a caller coordinating a mic control. */
  onPlaybackStart?: () => void;
  /** Fires on the <audio> element's real 'pause'/'ended' events. */
  onPlaybackEnd?: () => void;
  /** Shows a live playback-amplitude presence indicator next to the control. Defaults to true; gracefully falls back to an ambient pulse wherever Web Audio decoding isn't available. */
  showLevelMeter?: boolean;
  /** Mutes the underlying <audio> element's output — playback (and onPlaybackStart/onPlaybackEnd turn-state) still runs normally, only the sound is silenced. Defaults to false. */
  muted?: boolean;
  /** A short label (e.g. "AI") centered in the orb while not speaking, so the tile reads as an identity, not a bare circle — replaced by the live level meter once playback actually starts. Omit for the orb's previous meter-only behavior. */
  avatarLabel?: string;
}

type Status = 'loading' | 'ready' | 'error';

/**
 * Speaks a question aloud via a developer-supplied synthesize() and always
 * offers a manual control — autoplay is attempted but browsers block it
 * without a prior user gesture, so a blocked attempt just falls back to a
 * "Play question" button instead of failing silently.
 */
export function QuestionAudio({
  text,
  synthesize,
  onError,
  autoPlay = true,
  onPlaybackStart,
  onPlaybackEnd,
  showLevelMeter = true,
  muted = false,
  avatarLabel,
}: QuestionAudioProps) {
  // A state-backed ref (not useRef): the level-meter hook below needs to
  // react to the element becoming available, and reading a plain ref's
  // `.current` during render isn't safe/reactive.
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [rawAudio, setRawAudio] = useState<ArrayBuffer | Uint8Array | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Assumes one QuestionAudio instance per question/follow-up prompt (the
  // caller renders it with `key={text}`) — a fresh mount naturally starts
  // from the default 'loading' state, so there's nothing to reset here.
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    synthesize(text)
      .then((result) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(
          new Blob([result.audio as BlobPart], { type: result.mimeType }),
        );
        setAudioUrl(objectUrl);
        setRawAudio(result.audio);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus('error');
        onError?.(error instanceof Error ? error : new Error(String(error)));
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-synthesize on text change only; synthesize/onError are expected to be stable per session
  }, [text]);

  useEffect(() => {
    // audioEl starts null and populates via the ref callback below on its
    // own commit/render — without this guard, `audioEl?.play()` on that
    // first null pass resolves to `Promise.resolve(undefined)`, which
    // always "succeeds" and would wrongly mark hasPlayedOnce before the
    // real autoplay attempt (once the element actually exists) ever runs.
    if (status !== 'ready' || !autoPlay || !audioEl) return;
    // Always start from the beginning — matters once a caller's own replay
    // logic (or this same effect re-firing for any reason) targets an
    // element that already reached the end: play() from an end-of-track
    // position produces no audible sound at all.
    // eslint-disable-next-line react-hooks/immutability -- a real DOM element's own playback position, not application state; audioEl is only state-backed for the level-meter hook's reactivity (see the field comment above)
    audioEl.currentTime = 0;
    // Wrapped in Promise.resolve(): most browsers return a Promise from
    // play(), but older Safari can return undefined instead — treat that as
    // playback having started, same as it does natively.
    Promise.resolve(audioEl.play())
      .then(() => setHasPlayedOnce(true))
      .catch(() => {
        // Autoplay was blocked (no prior user gesture in this tab) — the
        // "Play question" button below covers this, so it's not an error.
      });
  }, [status, autoPlay, audioEl]);

  const { levels, isSupported } = useSpeechLevelMeter(audioEl, rawAudio, isPlaying);

  if (status === 'error') return null;

  const play = () => {
    if (!audioEl) return;
    // "Replay question" after the track already ended must rewind first —
    // otherwise play() just resumes from the end-of-track position and
    // produces no audible sound, even though playback technically "works".
    // eslint-disable-next-line react-hooks/immutability -- a real DOM element's own playback position, not application state
    audioEl.currentTime = 0;
    Promise.resolve(audioEl.play())
      .then(() => setHasPlayedOnce(true))
      .catch((error: unknown) =>
        onError?.(error instanceof Error ? error : new Error(String(error))),
      );
  };

  const handlePlaybackStart = () => {
    setIsPlaying(true);
    onPlaybackStart?.();
  };

  const handlePlaybackEnd = () => {
    setIsPlaying(false);
    onPlaybackEnd?.();
  };

  return (
    <div className="isdk-question-audio">
      {audioUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- the question text is always shown visibly in QuestionCard; this audio is a redundant, optional channel
        <audio
          ref={setAudioEl}
          src={audioUrl}
          muted={muted}
          onPlay={handlePlaybackStart}
          onPause={handlePlaybackEnd}
          onEnded={handlePlaybackEnd}
        />
      )}
      {showLevelMeter && (
        <span
          className={
            isPlaying
              ? 'isdk-question-audio__orb isdk-question-audio__orb--active'
              : 'isdk-question-audio__orb'
          }
        >
          {avatarLabel && !isPlaying ? (
            <span className="isdk-question-audio__orb-label" aria-hidden="true">
              {avatarLabel}
            </span>
          ) : (
            <AudioLevelMeter levels={levels} variant="speaking" isIdle={!isSupported || !isPlaying} />
          )}
        </span>
      )}
      <button
        className="isdk-btn isdk-btn--secondary isdk-btn--audio"
        type="button"
        onClick={play}
        disabled={status === 'loading'}
      >
        {status === 'loading'
          ? 'Loading audio…'
          : hasPlayedOnce
            ? 'Replay question'
            : 'Play question'}
      </button>
    </div>
  );
}
