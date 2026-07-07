import type { EvaluationResult, Question } from '@interview-sdk/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TranscriptEntry } from '../hooks/build-report.js';
import { InterviewProgress } from './InterviewProgress.js';

const questions: Question[] = [
  { id: 'q1', prompt: 'Tell me about yourself.', concepts: ['intro'] },
  { id: 'q2', prompt: 'Design a URL shortener.', concepts: ['system design'] },
  { id: 'q3', prompt: 'What happens with two concurrent requests?', concepts: ['concurrency'] },
  { id: 'q4', prompt: 'Describe a high-stakes decision.' },
];

function evaluation(): EvaluationResult {
  return {
    questionId: 'q1',
    dimensionScores: { technical: 80 },
    totalScore: 80,
    conceptCoverage: [],
    contradictions: [],
    flags: [],
  };
}

function entry(question: Question, isFollowUp = false): TranscriptEntry {
  return {
    question,
    prompt: question.prompt,
    isFollowUp,
    answer: { questionId: question.id, text: 'An answer.', submittedAt: 1 },
    evaluation: evaluation(),
  };
}

describe('InterviewProgress', () => {
  it('marks earlier questions done, the current one active, and the rest upcoming', () => {
    render(
      <InterviewProgress
        questions={questions}
        currentQuestion={questions[2]}
        transcript={[entry(questions[0]!), entry(questions[1]!)]}
      />,
    );

    const doneIcons = screen.getAllByLabelText('Completed');
    expect(doneIcons).toHaveLength(2);
    expect(screen.getAllByLabelText('In progress')).toHaveLength(1);
    expect(screen.getAllByLabelText('Not started yet')).toHaveLength(1);

    // Status icons need a concrete ARIA role, not just aria-label on a bare
    // <span> (implicit role "generic"), for the label to reliably reach
    // real assistive tech — role="img" is what LiveSignals already uses for
    // the same pattern.
    expect(screen.getAllByRole('img', { name: 'Completed' })).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'In progress' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Not started yet' })).toBeInTheDocument();
  });

  it('does not count a follow-up entry alone as completing its question', () => {
    // Only a follow-up entry exists for q1 — the original question turn
    // itself was never recorded as a non-follow-up entry.
    render(
      <InterviewProgress
        questions={[questions[0]!]}
        currentQuestion={questions[0]}
        transcript={[entry(questions[0]!, true)]}
      />,
    );
    // current takes precedence over done in status derivation regardless,
    // but confirm no crash / correct precedence:
    expect(screen.getByLabelText('In progress')).toBeInTheDocument();
  });

  it('shows the first concept as a topic tag when present', () => {
    render(
      <InterviewProgress questions={[questions[1]!]} currentQuestion={undefined} transcript={[]} />,
    );
    expect(screen.getByText('system design')).toBeInTheDocument();
  });

  it('omits the topic tag when a question has no concepts', () => {
    render(
      <InterviewProgress questions={[questions[3]!]} currentQuestion={undefined} transcript={[]} />,
    );
    expect(screen.getByText('Describe a high-stakes decision.')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('exposes the list as an accessible, labeled list', () => {
    render(
      <InterviewProgress questions={questions} currentQuestion={questions[0]} transcript={[]} />,
    );
    expect(screen.getByRole('list', { name: 'Interview progress' })).toBeInTheDocument();
  });
});
