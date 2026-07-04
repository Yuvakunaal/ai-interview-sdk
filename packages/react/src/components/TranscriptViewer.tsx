import type { TranscriptEntry } from '../hooks/build-report.js';

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
    return <p>No answers yet.</p>;
  }

  return (
    <ol aria-label="Interview transcript" role="log" aria-live="polite">
      {transcript.map((entry, index) => (
        <li key={`${entry.question.id}-${index}`}>
          <p>
            <strong>{entry.isFollowUp ? 'Follow-up: ' : `Q${index + 1}: `}</strong>
            {entry.prompt}
          </p>
          <p>{answerText(entry)}</p>
          <p>Score: {entry.evaluation.totalScore}/100</p>
        </li>
      ))}
    </ol>
  );
}
