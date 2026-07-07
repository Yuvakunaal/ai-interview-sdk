import type { EvaluationResult, Question } from '@interview-sdk/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TranscriptEntry } from '../hooks/build-report.js';
import { TranscriptChat } from './TranscriptChat.js';

const question: Question = { id: 'q1', prompt: 'Explain hash maps.' };

function evaluation(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    questionId: 'q1',
    dimensionScores: { technical: 80 },
    totalScore: 80,
    conceptCoverage: [],
    contradictions: [],
    flags: [],
    ...overrides,
  };
}

function entry(overrides: Partial<TranscriptEntry> = {}): TranscriptEntry {
  return {
    question,
    prompt: question.prompt,
    isFollowUp: false,
    answer: { questionId: 'q1', text: 'It uses buckets.', submittedAt: 1 },
    evaluation: evaluation(),
    ...overrides,
  };
}

describe('TranscriptChat', () => {
  it('shows a placeholder when there is no transcript yet', () => {
    render(<TranscriptChat transcript={[]} />);
    expect(screen.getByText('No messages yet.')).toBeInTheDocument();
  });

  it('renders the AI prompt and the candidate answer as separate messages', () => {
    render(<TranscriptChat transcript={[entry()]} />);
    expect(screen.getByText('Explain hash maps.')).toBeInTheDocument();
    expect(screen.getByText('It uses buckets.')).toBeInTheDocument();
    expect(screen.getAllByText('AI Interviewer').length).toBeGreaterThan(0);
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('shows "(Skipped)" for a skipped answer', () => {
    render(
      <TranscriptChat
        transcript={[
          entry({ answer: { questionId: 'q1', text: '', submittedAt: 1, isSkipped: true } }),
        ]}
      />,
    );
    expect(screen.getByText('(Skipped)')).toBeInTheDocument();
  });

  it('shows "(No response)" for a silent answer', () => {
    render(
      <TranscriptChat
        transcript={[
          entry({ answer: { questionId: 'q1', text: '', submittedAt: 1, isSilence: true } }),
        ]}
      />,
    );
    expect(screen.getByText('(No response)')).toBeInTheDocument();
  });

  it('renders a rationale bubble when the evaluation has one', () => {
    render(
      <TranscriptChat
        transcript={[entry({ evaluation: evaluation({ rationale: 'Strong answer overall.' }) })]}
      />,
    );
    expect(screen.getByText('Strong answer overall.')).toBeInTheDocument();
  });

  it('does not render a rationale bubble when the evaluation lacks one', () => {
    render(<TranscriptChat transcript={[entry()]} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders every entry, in order, across multiple turns', () => {
    render(
      <TranscriptChat
        transcript={[
          entry({ prompt: 'First question.' }),
          entry({ isFollowUp: true, prompt: 'Follow-up on first.' }),
        ]}
      />,
    );
    expect(screen.getByText('First question.')).toBeInTheDocument();
    expect(screen.getByText('Follow-up on first.')).toBeInTheDocument();
  });

  it('supports custom assistant/candidate names', () => {
    render(<TranscriptChat transcript={[entry()]} assistantName="Nova" candidateName="Alex" />);
    expect(screen.getAllByText('Nova').length).toBeGreaterThan(0);
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('exposes the transcript as an accessible live log region', () => {
    render(<TranscriptChat transcript={[entry()]} />);
    const log = screen.getByRole('log', { name: 'Interview transcript' });
    expect(log).toHaveAttribute('aria-live', 'polite');
  });

  it('is keyboard-focusable so it can be scrolled without a mouse once it grows past its visible height', () => {
    render(<TranscriptChat transcript={[entry()]} />);
    expect(screen.getByRole('log', { name: 'Interview transcript' })).toHaveAttribute(
      'tabIndex',
      '0',
    );
  });
});
