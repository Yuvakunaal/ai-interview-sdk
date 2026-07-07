import type { TranscriptEntry } from '../hooks/build-report.js';

export interface FeedbackNoteProps {
  transcript: TranscriptEntry[];
  /** Label shown above the note. Defaults to 'AI Interviewer', matching the stage tile's own label. */
  assistantName?: string;
}

/**
 * A chat-style note surfacing the AI's own rationale for the most recent
 * scored answer — evaluation.rationale is a real field populated by the
 * evaluation engine's model response (see @interview-sdk/core), not
 * fabricated UI copy. Renders nothing when no scored entry has a rationale
 * yet (e.g. a skipped/silent answer, or an adapter that doesn't return one).
 */
export function FeedbackNote({ transcript, assistantName = 'AI Interviewer' }: FeedbackNoteProps) {
  const latestWithRationale = [...transcript].reverse().find((entry) => entry.evaluation.rationale);
  if (!latestWithRationale) return null;

  return (
    <div className="isdk-feedback-note" role="status">
      <p className="isdk-feedback-note__label">{assistantName}</p>
      <p className="isdk-feedback-note__text">{latestWithRationale.evaluation.rationale}</p>
    </div>
  );
}
