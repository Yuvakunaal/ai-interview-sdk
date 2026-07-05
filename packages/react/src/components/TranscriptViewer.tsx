import type { CSSProperties } from 'react';
import type { TranscriptEntry } from '../hooks/build-report.js';
import { scoreTier } from './score-tier.js';

export interface TranscriptViewerProps {
  transcript: TranscriptEntry[];
}

function answerText(entry: TranscriptEntry): string {
  if (entry.answer.isSkipped) return '(Skipped)';
  if (entry.answer.isSilence) return '(No response)';
  return entry.answer.text;
}

/**
 * Renders the full text of every prompt and answer. This is also the
 * accessibility "captions" requirement: nothing in this SDK is presented as
 * audio-only — whatever a voice layer speaks or transcribes always has a
 * visible text equivalent here.
 */
export function TranscriptViewer({ transcript }: TranscriptViewerProps) {
  if (transcript.length === 0) {
    return <p className="isdk-transcript__empty">No answers yet.</p>;
  }

  return (
    <ol className="isdk-transcript" aria-label="Interview transcript" role="log" aria-live="polite">
      {transcript.map((entry, index) => (
        <li
          className="isdk-transcript__entry"
          key={`${entry.question.id}-${index}`}
          style={{ '--isdk-d': index } as CSSProperties}
        >
          <p className="isdk-transcript__prompt">
            <strong className="isdk-kicker">
              {entry.isFollowUp ? 'Follow-up: ' : `Q${index + 1}: `}
            </strong>
            {entry.prompt}
          </p>
          <p className="isdk-transcript__answer">{answerText(entry)}</p>
          <p
            className={`isdk-transcript__score isdk-chip isdk-chip--${scoreTier(entry.evaluation.totalScore)} isdk-tabular`}
          >
            Score: {entry.evaluation.totalScore}/100
          </p>
        </li>
      ))}
    </ol>
  );
}
