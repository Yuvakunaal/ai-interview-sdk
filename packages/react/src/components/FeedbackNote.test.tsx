import type { Question } from '@interview-sdk/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TranscriptEntry } from '../hooks/build-report.js';
import { FeedbackNote } from './FeedbackNote.js';

const question: Question = { id: 'q1', prompt: 'Explain hash maps.' };

function entry(rationale: string | undefined, overrides: Partial<TranscriptEntry> = {}): TranscriptEntry {
  return {
    question,
    prompt: question.prompt,
    isFollowUp: false,
    answer: { questionId: 'q1', text: 'An answer.', submittedAt: 1 },
    evaluation: {
      questionId: 'q1',
      dimensionScores: { technical: 80 },
      totalScore: 80,
      conceptCoverage: [],
      contradictions: [],
      flags: [],
      rationale,
    },
    ...overrides,
  };
}

describe('FeedbackNote', () => {
  it('renders nothing when no transcript entry has a rationale', () => {
    const { container } = render(<FeedbackNote transcript={[entry(undefined), entry(undefined)]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an empty transcript', () => {
    const { container } = render(<FeedbackNote transcript={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the most recent rationale under the default assistant label', () => {
    render(
      <FeedbackNote
        transcript={[entry('First take: solid basics.'), entry('Nice depth on trade-offs.')]}
      />,
    );
    expect(screen.getByText('AI Interviewer')).toBeInTheDocument();
    expect(screen.getByText('Nice depth on trade-offs.')).toBeInTheDocument();
    expect(screen.queryByText('First take: solid basics.')).not.toBeInTheDocument();
  });

  it('falls back to an earlier entry with a rationale if the latest one lacks it (e.g. a skip)', () => {
    render(
      <FeedbackNote
        transcript={[
          entry('Solid answer overall.'),
          entry(undefined, { answer: { questionId: 'q1', text: '', submittedAt: 2, isSkipped: true } }),
        ]}
      />,
    );
    expect(screen.getByText('Solid answer overall.')).toBeInTheDocument();
  });

  it('supports a custom assistant name', () => {
    render(<FeedbackNote transcript={[entry('Good stuff.')]} assistantName="Nova" />);
    expect(screen.getByText('Nova')).toBeInTheDocument();
  });

  it('is an accessible live status region', () => {
    render(<FeedbackNote transcript={[entry('Good stuff.')]} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
