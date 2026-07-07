import { useEffect, useRef } from 'react';
import type { TranscriptEntry } from '../hooks/build-report.js';

export interface TranscriptChatProps {
  transcript: TranscriptEntry[];
  /** Label shown above the AI's messages. Defaults to 'AI Interviewer'. */
  assistantName?: string;
  /** Label shown above the candidate's messages. Defaults to 'You'. */
  candidateName?: string;
}

function answerText(entry: TranscriptEntry): string {
  if (entry.answer.isSkipped) return '(Skipped)';
  if (entry.answer.isSilence) return '(No response)';
  return entry.answer.text;
}

/**
 * The running conversation as chat bubbles — every AI prompt and every
 * candidate answer, in order, plus the AI's own rationale (a real field
 * from EvaluationResult, not fabricated copy) when one was returned for
 * that answer. This is also the accessibility "captions" requirement
 * TranscriptViewer documents: nothing here is audio-only, so this list
 * keeps the same `role="log"` live-region contract.
 */
export function TranscriptChat({
  transcript,
  assistantName = 'AI Interviewer',
  candidateName = 'You',
}: TranscriptChatProps) {
  const bottomRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'end' });
  }, [transcript.length]);

  if (transcript.length === 0) {
    return <p className="isdk-transcript-chat__empty">No messages yet.</p>;
  }

  // This is a scrollable region taller than its viewport with no focusable
  // descendants — without tabIndex, a keyboard-only user has no way to
  // scroll it once the conversation grows past the visible height.
  return (
    <ol
      className="isdk-transcript-chat"
      aria-label="Interview transcript"
      role="log"
      aria-live="polite"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
    >
      {transcript.map((entry, index) => (
        <li className="isdk-transcript-chat__group" key={`${entry.question.id}-${index}`}>
          <div className="isdk-transcript-chat__bubble isdk-transcript-chat__bubble--ai">
            <p className="isdk-transcript-chat__from">{assistantName}</p>
            <p className="isdk-transcript-chat__text">{entry.prompt}</p>
          </div>
          <div className="isdk-transcript-chat__bubble isdk-transcript-chat__bubble--you">
            <p className="isdk-transcript-chat__from">{candidateName}</p>
            <p className="isdk-transcript-chat__text">{answerText(entry)}</p>
          </div>
          {entry.evaluation.rationale && (
            <div
              className="isdk-transcript-chat__bubble isdk-transcript-chat__bubble--note"
              role="status"
            >
              <p className="isdk-transcript-chat__from isdk-transcript-chat__from--note">
                <span className="isdk-transcript-chat__note-icon" aria-hidden="true" />
                Feedback
              </p>
              <p className="isdk-transcript-chat__text">{entry.evaluation.rationale}</p>
            </div>
          )}
        </li>
      ))}
      <li ref={bottomRef} aria-hidden="true" />
    </ol>
  );
}
