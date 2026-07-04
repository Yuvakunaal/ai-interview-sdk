import type { EvaluationResult, Question } from '@interview-sdk/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TranscriptEntry } from '../hooks/build-report.js';
import { TranscriptViewer } from './TranscriptViewer.js';

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

describe('TranscriptViewer', () => {
  it('shows a placeholder when there is no transcript yet', () => {
    render(<TranscriptViewer transcript={[]} />);
    expect(screen.getByText('No answers yet.')).toBeInTheDocument();
  });

  it('renders the prompt, answer, and score for each entry', () => {
    render(<TranscriptViewer transcript={[entry()]} />);
    expect(screen.getByText('Explain hash maps.')).toBeInTheDocument();
    expect(screen.getByText('It uses buckets.')).toBeInTheDocument();
    expect(screen.getByText('Score: 80/100')).toBeInTheDocument();
  });

  it('labels a follow-up entry distinctly from a numbered question', () => {
    render(
      <TranscriptViewer transcript={[entry({ isFollowUp: true, prompt: 'Can you say more?' })]} />,
    );
    expect(screen.getByText('Follow-up:')).toBeInTheDocument();
    expect(screen.getByText('Can you say more?')).toBeInTheDocument();
  });

  it('numbers non-follow-up entries in order', () => {
    render(
      <TranscriptViewer
        transcript={[
          entry({ prompt: 'First question.' }),
          entry({ isFollowUp: true, prompt: 'Follow-up on first.' }),
          entry({ prompt: 'Second question.' }),
        ]}
      />,
    );
    expect(screen.getByText('Q1:')).toBeInTheDocument();
    expect(screen.getByText('Q3:')).toBeInTheDocument();
  });

  it('shows "(Skipped)" for a skipped answer', () => {
    render(
      <TranscriptViewer
        transcript={[
          entry({ answer: { questionId: 'q1', text: '', submittedAt: 1, isSkipped: true } }),
        ]}
      />,
    );
    expect(screen.getByText('(Skipped)')).toBeInTheDocument();
  });

  it('shows "(No response)" for a silent answer', () => {
    render(
      <TranscriptViewer
        transcript={[
          entry({ answer: { questionId: 'q1', text: '', submittedAt: 1, isSilence: true } }),
        ]}
      />,
    );
    expect(screen.getByText('(No response)')).toBeInTheDocument();
  });

  it('exposes the transcript as an accessible live log region', () => {
    render(<TranscriptViewer transcript={[entry()]} />);
    const log = screen.getByRole('log', { name: 'Interview transcript' });
    expect(log).toHaveAttribute('aria-live', 'polite');
  });
});
