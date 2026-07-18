import { defineRubric } from '@interview-sdk/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScoreSummary } from './ScoreSummary.js';

const rubric = defineRubric([
  { id: 'technical', label: 'Technical', weight: 3 },
  { id: 'communication', label: 'Communication', weight: 1 },
]);

describe('ScoreSummary', () => {
  it('renders the overall score', () => {
    render(
      <ScoreSummary
        totalScore={82.5}
        rubric={rubric}
        dimensionAverages={{ technical: 90, communication: 60 }}
      />,
    );
    expect(screen.getByText('82.5/100')).toBeInTheDocument();
  });

  it('renders a row per rubric dimension with its label and average score', () => {
    render(
      <ScoreSummary
        totalScore={82.5}
        rubric={rubric}
        dimensionAverages={{ technical: 90, communication: 60 }}
      />,
    );

    const technicalRow = screen.getByRole('rowheader', { name: 'Technical' }).closest('tr');
    expect(technicalRow).toHaveTextContent('90/100');

    const communicationRow = screen.getByRole('rowheader', { name: 'Communication' }).closest('tr');
    expect(communicationRow).toHaveTextContent('60/100');
  });

  it('omits a dimension no question ever assessed entirely, rather than showing a false 0/100', () => {
    // Reproduces a real report: a rubric dimension ("Systems thinking")
    // that no question in the interview actually addressed previously
    // rendered as a demoralizing 0/100, implying real failure at something
    // the candidate was never asked about.
    render(<ScoreSummary totalScore={0} rubric={rubric} dimensionAverages={{}} />);
    expect(screen.queryByRole('rowheader', { name: 'Technical' })).not.toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: 'Communication' })).not.toBeInTheDocument();
  });

  it('shows only the dimensions that were actually assessed, omitting the rest', () => {
    render(
      <ScoreSummary totalScore={90} rubric={rubric} dimensionAverages={{ technical: 90 }} />,
    );
    expect(screen.getByRole('rowheader', { name: 'Technical' })).toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: 'Communication' })).not.toBeInTheDocument();
  });

  it('uses a semantic table with column headers for accessibility', () => {
    render(
      <ScoreSummary
        totalScore={82.5}
        rubric={rubric}
        dimensionAverages={{ technical: 90, communication: 60 }}
      />,
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Dimension' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Score' })).toBeInTheDocument();
  });
});
