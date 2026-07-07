import type { Question } from '@interview-sdk/core';
import type { TranscriptEntry } from '../hooks/build-report.js';

export interface InterviewProgressProps {
  questions: Question[];
  currentQuestion: Question | undefined;
  transcript: TranscriptEntry[];
}

type QuestionStatus = 'done' | 'active' | 'upcoming';

function statusOf(
  question: Question,
  currentQuestion: Question | undefined,
  transcript: TranscriptEntry[],
): QuestionStatus {
  if (currentQuestion?.id === question.id) return 'active';
  const answered = transcript.some((entry) => !entry.isFollowUp && entry.question.id === question.id);
  return answered ? 'done' : 'upcoming';
}

const STATUS_LABEL: Record<QuestionStatus, string> = {
  done: 'Completed',
  active: 'In progress',
  upcoming: 'Not started yet',
};

/**
 * A running checklist of every question in the interview and where the
 * candidate is right now — built entirely from data useInterview already
 * exposes (questions + transcript + currentQuestion), no new session state.
 */
export function InterviewProgress({ questions, currentQuestion, transcript }: InterviewProgressProps) {
  return (
    <div className="isdk-progress">
      <p className="isdk-kicker">Interview progress</p>
      <ol className="isdk-progress__list" aria-label="Interview progress">
        {questions.map((question) => {
          const status = statusOf(question, currentQuestion, transcript);
          const topic = question.concepts?.[0];

          return (
            <li
              key={question.id}
              className={`isdk-progress__item isdk-progress__item--${status}`}
            >
              <span className="isdk-progress__icon" role="img" aria-label={STATUS_LABEL[status]}>
                {status === 'done' && (
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M3 8.5L6.2 11.5L13 4.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                {status === 'active' && <span className="isdk-progress__dot" aria-hidden="true" />}
              </span>
              <div className="isdk-progress__body">
                {topic && <p className="isdk-progress__topic">{topic}</p>}
                <p className="isdk-progress__prompt">{question.prompt}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
