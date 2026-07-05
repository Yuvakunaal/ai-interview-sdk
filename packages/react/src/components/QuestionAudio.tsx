import type { SynthesisResult } from '@interview-sdk/core';
import { useEffect, useRef, useState } from 'react';

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
}

type Status = 'loading' | 'ready' | 'error';

/**
 * Speaks a question aloud via a developer-supplied synthesize() and always
 * offers a manual control — autoplay is attempted but browsers block it
 * without a prior user gesture, so a blocked attempt just falls back to a
 * "Play question" button instead of failing silently.
 */
export function QuestionAudio({ text, synthesize, onError, autoPlay = true }: QuestionAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

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
    if (status !== 'ready' || !autoPlay) return;
    // Wrapped in Promise.resolve(): most browsers return a Promise from
    // play(), but older Safari can return undefined instead — treat that as
    // playback having started, same as it does natively.
    Promise.resolve(audioRef.current?.play())
      .then(() => setHasPlayedOnce(true))
      .catch(() => {
        // Autoplay was blocked (no prior user gesture in this tab) — the
        // "Play question" button below covers this, so it's not an error.
      });
  }, [status, autoPlay]);

  if (status === 'error') return null;

  const play = () => {
    Promise.resolve(audioRef.current?.play())
      .then(() => setHasPlayedOnce(true))
      .catch((error: unknown) =>
        onError?.(error instanceof Error ? error : new Error(String(error))),
      );
  };

  return (
    <div className="isdk-question-audio">
      {audioUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- the question text is always shown visibly in QuestionCard; this audio is a redundant, optional channel
        <audio ref={audioRef} src={audioUrl} />
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
