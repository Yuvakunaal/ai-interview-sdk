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

  // A follow-up shares its parent question's slot rather than claiming the
  // next number itself — counting the raw array index instead would number
  // every question AFTER the first follow-up one too high (a transcript's
  // length grows with follow-ups, but there's still the same number of
  // actual questions).
  const questionNumbers = transcript.reduce<number[]>((numbers, entry) => {
    const previous = numbers.at(-1) ?? 0;
    numbers.push(entry.isFollowUp ? previous : previous + 1);
    return numbers;
  }, []);

  return (
    <ol className="isdk-transcript" aria-label="Interview transcript" role="log" aria-live="polite">
      {transcript.map((entry, index) => (
        <li
          className={
            entry.isFollowUp
              ? 'isdk-transcript__entry isdk-transcript__entry--followup'
              : 'isdk-transcript__entry'
          }
          key={`${entry.question.id}-${index}`}
          style={{ '--isdk-d': index } as CSSProperties}
        >
          <div className="isdk-transcript__entry-head">
            <strong className="isdk-kicker">
              {entry.isFollowUp ? 'Follow-up' : `Q${questionNumbers[index]}`}
            </strong>
            <span
              className={`isdk-transcript__score isdk-chip isdk-chip--${scoreTier(entry.evaluation.totalScore)} isdk-tabular`}
            >
              Score: {entry.evaluation.totalScore}/100
            </span>
          </div>
          <p className="isdk-transcript__prompt">{entry.prompt}</p>
          <p className="isdk-transcript__answer">{answerText(entry)}</p>
        </li>
      ))}
    </ol>
  );
}
