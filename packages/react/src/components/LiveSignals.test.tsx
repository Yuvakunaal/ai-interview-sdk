import type { Question, Rubric } from '@interview-sdk/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TranscriptEntry } from '../hooks/build-report.js';
import { LiveSignals } from './LiveSignals.js';

const question: Question = { id: 'q1', prompt: 'Explain hash maps.' };

const rubric: Rubric = {
  dimensions: [
    { id: 'technical', label: 'Technical depth', weight: 1, normalizedWeight: 0.5 },
    { id: 'clarity', label: 'Clarity', weight: 1, normalizedWeight: 0.5 },
  ],
};

function entry(dimensionScores: Record<string, number>): TranscriptEntry {
  return {
    question,
    prompt: question.prompt,
    isFollowUp: false,
    answer: { questionId: 'q1', text: 'An answer.', submittedAt: 1 },
    evaluation: {
      questionId: 'q1',
      dimensionScores,
      totalScore: 80,
      conceptCoverage: [],
      contradictions: [],
      flags: [],
    },
  };
}

describe('LiveSignals', () => {
  it('renders nothing before any answer has been scored', () => {
    const { container } = render(<LiveSignals rubric={rubric} transcript={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a bar per rubric dimension using the latest scored entry', () => {
    render(<LiveSignals rubric={rubric} transcript={[entry({ technical: 87, clarity: 91 })]} />);
    expect(screen.getByText('Technical depth')).toBeInTheDocument();
    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.getByText('Clarity')).toBeInTheDocument();
    expect(screen.getByText('91')).toBeInTheDocument();
  });

  it('uses the most recent entry, not an earlier one', () => {
    render(
      <LiveSignals
        rubric={rubric}
        transcript={[entry({ technical: 40, clarity: 40 }), entry({ technical: 74, clarity: 60 })]}
      />,
    );
    expect(screen.getByText('74')).toBeInTheDocument();
    expect(screen.queryByText('40')).not.toBeInTheDocument();
  });

  it('skips a dimension the evaluation never scored', () => {
    render(<LiveSignals rubric={rubric} transcript={[entry({ technical: 87 })]} />);
    expect(screen.getByText('Technical depth')).toBeInTheDocument();
    expect(screen.queryByText('Clarity')).not.toBeInTheDocument();
  });

  it('clamps an out-of-range score into a valid 0-100 bar', () => {
    render(<LiveSignals rubric={rubric} transcript={[entry({ technical: 140 })]} />);
    expect(screen.getByLabelText('Technical depth: 100 out of 100')).toBeInTheDocument();
  });

  it('announces new scores to screen readers via a live region, matching TranscriptChat', () => {
    const { container } = render(
      <LiveSignals rubric={rubric} transcript={[entry({ technical: 87, clarity: 91 })]} />,
    );
    const region = container.querySelector('.isdk-live-signals');
    expect(region).toHaveAttribute('role', 'log');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });
});
