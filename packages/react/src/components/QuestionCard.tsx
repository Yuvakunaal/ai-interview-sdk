import type { SynthesisResult } from '@interview-sdk/core';
import { useEffect, useId, useRef, useState } from 'react';
import { AudioLevelMeter } from './AudioLevelMeter.js';
import { MicButton, type AudioRecorder } from './MicButton.js';
import { QuestionAudio } from './QuestionAudio.js';

export interface QuestionCardProps {
  prompt: string;
  questionNumber: number;
  totalQuestions: number;
  isFollowUp?: boolean;
  /** A short topic tag shown on the question panel and stage (e.g. the current question's first concept). Omit for no tag. */
  topic?: string;
  /** The candidate's own display name — used for the candidate tile's label and avatar initial. Defaults to "You". */
  candidateName?: string;
  onSubmit: (text: string) => void;
  onSkip?: () => void;
  onRequestHint?: () => void;
  hint?: string;
  isSubmitting?: boolean;
  disabled?: boolean;
  /**
   * Enables the mic button, appending each transcript into the answer text.
   * Omit for text-only mode (the accessible default — a text input is
   * always present regardless of this prop).
   */
  transcribe?: (audio: Blob) => Promise<string>;
  /**
   * Enables speaking the prompt aloud (autoplayed, with a manual
   * play/replay fallback) — typically a VoiceProviderAdapter's
   * synthesize(). Omit for a silent, text-only prompt (the accessible
   * default — the prompt is always shown as text regardless of this prop).
   */
  synthesize?: (text: string) => Promise<SynthesisResult>;
  onVoiceError?: (error: Error) => void;
  /** Forwarded to MicButton; injectable for testing or a custom capture backend. */
  createRecorder?: () => Promise<AudioRecorder>;
  /** Notified whenever recording starts/stops — informational only, e.g. for a caller's own REC indicator. Not fired for the initial mount. */
  onRecordingChange?: (isRecording: boolean) => void;
  /** Live elapsed-time label (e.g. "3:45"). Omit to hide the timer entirely. */
  elapsedLabel?: string;
  /** Fraction (0-1) of the session's time budget used so far — renders a thin progress bar next to the timer. Omit when there's no fixed time budget. */
  elapsedFraction?: number;
  /** Pauses the session. Omit to hide the Pause control. Available in every mode, voice or text-only. */
  onPause?: () => void;
  pauseDisabled?: boolean;
  /** Notified with the character length of whatever was just pasted into the answer field — e.g. to feed InterviewWidget's integrity-signal tracking. Omit to not track pastes at all. */
  onAnswerPaste?: (pastedLength: number) => void;
}

type VoiceTurn = 'ai_speaking' | 'candidate_turn';

/**
 * A fresh prompt (new question or follow-up) always starts a new
 * conversation turn — rather than resetting turn-state/answer-text via an
 * effect, the body below remounts fresh per prompt via `key`, the same way
 * it already remounts QuestionAudio/MicButton internally. No reset logic
 * needed anywhere.
 *
 * The live announcement of that change lives here, in this non-remounting
 * wrapper, rather than as aria-live on the visible heading inside the
 * remounted body: a brand-new DOM node arriving with aria-live already on
 * it is generally not announced by assistive tech — only text *changing*
 * inside an already-present live region is. This element's text changing
 * on every prompt update is what actually reaches a screen reader.
 *
 * Focus itself is handled separately, inside the remounting QuestionCardBody
 * below: every remount destroys whatever element previously held focus
 * (e.g. the answer field), and without an explicit refocus the browser
 * drops focus to <body> — forcing a keyboard-only candidate to Tab from the
 * very top of the page after every single answer. Moving focus to the new
 * heading each time (the standard multi-step-form pattern) fixes that.
 */
export function QuestionCard(props: QuestionCardProps) {
  const { prompt, questionNumber, totalQuestions, isFollowUp } = props;
  const announcement = isFollowUp
    ? `Follow-up: ${prompt}`
    : `Question ${questionNumber} of ${totalQuestions}: ${prompt}`;

  return (
    <>
      <p aria-live="polite" className="isdk-visually-hidden">
        {announcement}
      </p>
      <QuestionCardBody key={prompt} {...props} />
    </>
  );
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function QuestionCardBody({
  prompt,
  questionNumber,
  totalQuestions,
  isFollowUp = false,
  topic,
  candidateName = 'You',
  onSubmit,
  onSkip,
  onRequestHint,
  hint,
  isSubmitting = false,
  disabled = false,
  transcribe,
  synthesize,
  onVoiceError,
  createRecorder,
  onRecordingChange,
  elapsedLabel,
  elapsedFraction,
  onPause,
  pauseDisabled = false,
  onAnswerPaste,
}: QuestionCardProps) {
  const [answerText, setAnswerText] = useState('');
  const [voiceTurn, setVoiceTurn] = useState<VoiceTurn>(() => (synthesize ? 'ai_speaking' : 'candidate_turn'));
  const [isRecording, setIsRecording] = useState(false);
  const [candidateLevels, setCandidateLevels] = useState<number[]>([]);
  const [candidateMeterSupported, setCandidateMeterSupported] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const textareaId = useId();
  const promptId = useId();
  const isFirstRecordingRender = useRef(true);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (isFirstRecordingRender.current) {
      isFirstRecordingRender.current = false;
      return;
    }
    onRecordingChange?.(isRecording);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notify on isRecording transitions only, skipping the initial mount
  }, [isRecording]);

  // This whole component remounts fresh per prompt (see QuestionCard above),
  // so a plain mount-only effect fires again on every new question/follow-up
  // — landing focus on the new heading each time, rather than leaving it
  // dropped on <body> once the previously-focused element is destroyed.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const isBusy = disabled || isSubmitting;
  const hasVoice = Boolean(synthesize || transcribe);
  const isAiSpeaking = voiceTurn === 'ai_speaking';
  // A transcript only lands in the answer box once recording actually
  // stops, so the box reads empty the whole time recording is in progress —
  // without this, "Submit answer" stayed clickable through that window and
  // would silently submit a blank answer if clicked mid-recording.
  const canSubmit = !isBusy && !isRecording && answerText.trim().length > 0;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit(answerText);
    setAnswerText('');
  };

  const handleTranscript = (text: string) => {
    setAnswerText((current) => (current ? `${current} ${text}` : text));
  };

  // A voice-channel failure (synthesis error, mic denial, transcription
  // failure) must never leave the candidate locked out of answering — always
  // release the turn back to them alongside reporting the error.
  const handleVoiceError = (error: Error) => {
    setVoiceTurn('candidate_turn');
    onVoiceError?.(error);
  };

  const turnLabel = isRecording
    ? '● Recording'
    : voiceTurn === 'ai_speaking'
      ? 'AI is asking…'
      : 'Your turn';
  const turnModifier = isRecording ? 'recording' : voiceTurn === 'ai_speaking' ? 'ai-speaking' : 'candidate-turn';

  const meta = (
    <p className="isdk-question-card__meta">
      Question {questionNumber} of {totalQuestions}
      {isFollowUp ? ' — follow-up' : ''}
      {topic ? ` — ${topic}` : ''}
    </p>
  );

  return (
    <section className="isdk-question-card" aria-labelledby={promptId}>
      {hasVoice ? (
        <div className="isdk-question-card__topbar isdk-question-card__topbar--overlay">
          {meta}
          <span className={`isdk-question-card__turn-pill isdk-question-card__turn-pill--${turnModifier}`}>
            {turnLabel}
          </span>
        </div>
      ) : (
        meta
      )}

      {hasVoice && (
        <div className="isdk-question-card__channel">
          <div
            className={
              isAiSpeaking
                ? 'isdk-question-card__party isdk-question-card__party--ai isdk-question-card__party--active'
                : 'isdk-question-card__party isdk-question-card__party--ai'
            }
          >
            <span className="isdk-question-card__party-avatar">
              {synthesize ? (
                <QuestionAudio
                  text={prompt}
                  synthesize={synthesize}
                  muted={speakerMuted}
                  onError={handleVoiceError}
                  onPlaybackStart={() => setVoiceTurn('ai_speaking')}
                  onPlaybackEnd={() => setVoiceTurn('candidate_turn')}
                  avatarLabel="AI"
                />
              ) : (
                <span className="isdk-question-audio__orb" aria-hidden="true">
                  <span className="isdk-question-audio__orb-label">AI</span>
                </span>
              )}
            </span>
            <span className="isdk-question-card__party-meta">
              <span className="isdk-question-card__party-name">AI Interviewer</span>
              <span className="isdk-question-card__party-status">
                {isAiSpeaking ? 'Speaking' : 'Listening'}
              </span>
            </span>
          </div>

          <span className="isdk-question-card__channel-link" aria-hidden="true">
            <span className="isdk-question-card__channel-link-dot" />
            <span className="isdk-question-card__channel-link-dot" />
            <span className="isdk-question-card__channel-link-dot" />
          </span>

          <div
            className={
              isRecording
                ? 'isdk-question-card__party isdk-question-card__party--candidate isdk-question-card__party--active'
                : 'isdk-question-card__party isdk-question-card__party--candidate'
            }
          >
            <span className="isdk-question-card__party-meta isdk-question-card__party-meta--right">
              <span className="isdk-question-card__party-name">{candidateName}</span>
              <span className="isdk-question-card__party-status">
                {isRecording ? 'Recording' : 'Muted'}
              </span>
            </span>
            <span className="isdk-question-card__party-avatar">
              <span className="isdk-question-card__avatar-mark" aria-hidden="true">
                {initialOf(candidateName)}
              </span>
              <AudioLevelMeter
                levels={candidateLevels}
                variant="listening"
                isIdle={!candidateMeterSupported}
              />
            </span>
          </div>
        </div>
      )}

      <div className="isdk-question-card__caption">
        <span className="isdk-question-card__index" aria-hidden="true">
          {String(questionNumber).padStart(2, '0')}
        </span>
        {/* Not a live region — this whole subtree remounts per prompt (see
            QuestionCard above), so aria-live here would never fire. The
            visually-hidden announcer in the non-remounting wrapper covers it. */}
        <h2 className="isdk-question-card__prompt" id={promptId} ref={headingRef} tabIndex={-1}>
          {prompt}
        </h2>
      </div>

      {hint && (
        <p className="isdk-question-card__hint" role="note" aria-label="Hint">
          {hint}
        </p>
      )}

      <form className="isdk-question-card__form" onSubmit={handleSubmit}>
        <div
          className={
            hasVoice
              ? 'isdk-question-card__composer isdk-question-card__composer--secondary'
              : 'isdk-question-card__composer'
          }
        >
          <label className="isdk-question-card__label" htmlFor={textareaId}>
            Your answer
          </label>
          <textarea
            className={
              hasVoice
                ? 'isdk-question-card__textarea isdk-question-card__textarea--secondary'
                : 'isdk-question-card__textarea'
            }
            id={textareaId}
            value={answerText}
            onChange={(event) => setAnswerText(event.target.value)}
            onPaste={
              onAnswerPaste
                ? (event) => onAnswerPaste(event.clipboardData.getData('text').length)
                : undefined
            }
            disabled={isBusy}
            rows={6}
          />
        </div>

        {(elapsedLabel || onPause) && (
          <div className="isdk-question-card__session-row">
            {elapsedLabel && (
              <div className="isdk-question-card__timer">
                <span className="isdk-question-card__timer-label">Session</span>
                <span className="isdk-tabular isdk-question-card__timer-value">{elapsedLabel}</span>
                {typeof elapsedFraction === 'number' && (
                  <span className="isdk-question-card__timer-bar" aria-hidden="true">
                    <span
                      style={{ width: `${Math.min(100, Math.max(0, elapsedFraction * 100))}%` }}
                    />
                  </span>
                )}
              </div>
            )}
            {onPause && (
              <button
                type="button"
                className="isdk-btn isdk-btn--secondary isdk-question-card__pause"
                onClick={onPause}
                disabled={pauseDisabled}
              >
                Pause
              </button>
            )}
          </div>
        )}

        {hasVoice ? (
          <div className="isdk-question-card__toolbar">
            <div className="isdk-question-card__toolbar-zone isdk-question-card__toolbar-zone--left">
              {synthesize && (
                <button
                  type="button"
                  className="isdk-btn isdk-btn--secondary isdk-btn--toolbar"
                  onClick={() => setSpeakerMuted((current) => !current)}
                  aria-pressed={speakerMuted}
                >
                  <svg className="isdk-btn__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
                    {!speakerMuted && (
                      <path
                        d="M16 9a4 4 0 0 1 0 6"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    )}
                    {speakerMuted && (
                      <path
                        d="M15 9l5 6M20 9l-5 6"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                  <span className="isdk-btn__label">Speaker</span>
                </button>
              )}
            </div>

            <div className="isdk-question-card__toolbar-zone isdk-question-card__toolbar-zone--center">
              {transcribe && (
                <MicButton
                  transcribe={transcribe}
                  onTranscript={handleTranscript}
                  onError={handleVoiceError}
                  disabled={isBusy || isAiSpeaking}
                  emphasized={voiceTurn === 'candidate_turn' && !isRecording}
                  onRecordingChange={setIsRecording}
                  showLevelMeter={false}
                  onLevelsChange={(levels, supported) => {
                    setCandidateLevels(levels);
                    setCandidateMeterSupported(supported);
                  }}
                  {...(createRecorder ? { createRecorder } : {})}
                />
              )}
            </div>

            <div className="isdk-question-card__toolbar-zone isdk-question-card__toolbar-zone--right">
              {onRequestHint && (
                <button
                  className="isdk-btn isdk-btn--secondary isdk-btn--toolbar"
                  type="button"
                  onClick={onRequestHint}
                  disabled={isBusy}
                >
                  <svg className="isdk-btn__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M9 18h6M10 21h4M7 9a5 5 0 1 1 8.5 3.5c-.7.7-1.2 1.5-1.4 2.5H9.9c-.2-1-.7-1.8-1.4-2.5A5 5 0 0 1 7 9Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="isdk-btn__label">Hints</span>
                </button>
              )}

              {onSkip && (
                <button
                  className="isdk-btn isdk-btn--secondary isdk-btn--toolbar"
                  type="button"
                  onClick={onSkip}
                  disabled={isBusy}
                >
                  <svg className="isdk-btn__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 6v12l8-6-8-6zM14 6v12l8-6-8-6z" fill="currentColor" />
                  </svg>
                  <span className="isdk-btn__label">Skip</span>
                </button>
              )}

              <button className="isdk-btn isdk-btn--primary" type="submit" disabled={!canSubmit}>
                Submit answer
              </button>
            </div>
          </div>
        ) : (
          <div className="isdk-question-card__actions">
            <button className="isdk-btn isdk-btn--primary" type="submit" disabled={!canSubmit}>
              Submit answer
            </button>
            {onRequestHint && (
              <button
                className="isdk-btn isdk-btn--secondary"
                type="button"
                onClick={onRequestHint}
                disabled={isBusy}
              >
                Request a hint
              </button>
            )}
            {onSkip && (
              <button
                className="isdk-btn isdk-btn--secondary"
                type="button"
                onClick={onSkip}
                disabled={isBusy}
              >
                Skip question
              </button>
            )}
          </div>
        )}
      </form>
    </section>
  );
}
