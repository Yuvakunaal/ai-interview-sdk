import { useId, useState } from 'react';
import { MicButton, type AudioRecorder } from './MicButton.js';

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
    <section aria-labelledby={promptId}>
      <p>
        Question {questionNumber} of {totalQuestions}
        {isFollowUp ? ' — follow-up' : ''}
      </p>
      <h2 id={promptId} aria-live="polite">
        {prompt}
      </h2>

      {hint && (
        <p role="note" aria-label="Hint">
          {hint}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <label htmlFor={textareaId}>Your answer</label>
        <textarea
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

        <div>
          <button type="submit" disabled={isBusy}>
            Submit answer
          </button>
          {onRequestHint && (
            <button type="button" onClick={onRequestHint} disabled={isBusy}>
              Request a hint
            </button>
          )}
          {onSkip && (
            <button type="button" onClick={onSkip} disabled={isBusy}>
              Skip question
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
