import { useId } from 'react';
import type { Rubric } from '@interview-sdk/core';

export interface ScoreSummaryProps {
  totalScore: number;
  rubric: Rubric;
  dimensionAverages: Record<string, number>;
}

export function ScoreSummary({ totalScore, rubric, dimensionAverages }: ScoreSummaryProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>Score Summary</h2>
      <p>
        Overall score: <strong>{totalScore}/100</strong>
      </p>
      <table>
        <caption>Score breakdown by rubric dimension</caption>
        <thead>
          <tr>
            <th scope="col">Dimension</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {rubric.dimensions.map((dimension) => (
            <tr key={dimension.id}>
              <th scope="row">{dimension.label}</th>
              <td>{Math.round((dimensionAverages[dimension.id] ?? 0) * 100) / 100}/100</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
