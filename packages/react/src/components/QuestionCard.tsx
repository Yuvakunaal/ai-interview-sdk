import type { SynthesisResult } from '@interview-sdk/core';
import { useId, useState } from 'react';
import { MicButton, type AudioRecorder } from './MicButton.js';
import { QuestionAudio } from './QuestionAudio.js';

export interface QuestionCardProps {
  prompt: string;
  questionNumber: number;
  totalQuestions: number;
  isFollowUp?: boolean;
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
}

export function QuestionCard({
  prompt,
  questionNumber,
  totalQuestions,
  isFollowUp = false,
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
}: QuestionCardProps) {
  const [answerText, setAnswerText] = useState('');
  const textareaId = useId();
  const promptId = useId();

  const isBusy = disabled || isSubmitting;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    onSubmit(answerText);
    setAnswerText('');
  };

  const handleTranscript = (text: string) => {
    setAnswerText((current) => (current ? `${current} ${text}` : text));
  };

  return (
    <section className="isdk-question-card" aria-labelledby={promptId}>
      <p className="isdk-question-card__meta">
        Question {questionNumber} of {totalQuestions}
        {isFollowUp ? ' — follow-up' : ''}
      </p>
      <h2 className="isdk-question-card__prompt" id={promptId} aria-live="polite">
        {prompt}
      </h2>

      {synthesize && (
        <QuestionAudio key={prompt} text={prompt} synthesize={synthesize} onError={onVoiceError} />
      )}

      {hint && (
        <p className="isdk-question-card__hint" role="note" aria-label="Hint">
          {hint}
        </p>
      )}

      <form className="isdk-question-card__form" onSubmit={handleSubmit}>
        <label className="isdk-question-card__label" htmlFor={textareaId}>
          Your answer
        </label>
        <textarea
          className="isdk-question-card__textarea"
          id={textareaId}
          value={answerText}
          onChange={(event) => setAnswerText(event.target.value)}
          disabled={isBusy}
          rows={6}
        />

        {transcribe && (
          <MicButton
            transcribe={transcribe}
            onTranscript={handleTranscript}
            onError={onVoiceError}
            disabled={isBusy}
            {...(createRecorder ? { createRecorder } : {})}
          />
        )}

        <div className="isdk-question-card__actions">
          <button className="isdk-btn isdk-btn--primary" type="submit" disabled={isBusy}>
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
      </form>
    </section>
  );
}
