import { useId } from 'react';
import type { Rubric } from '@interview-sdk/core';
import { scoreTier } from './score-tier.js';

export interface ScoreSummaryProps {
  totalScore: number;
  rubric: Rubric;
  dimensionAverages: Record<string, number>;
}

export function ScoreSummary({ totalScore, rubric, dimensionAverages }: ScoreSummaryProps) {
  const headingId = useId();

  return (
    <section className="isdk-score-summary" aria-labelledby={headingId}>
      {/* h3: this section always nests inside ReportCard's own "Interview
          Report" h2, as a sibling of its "Strengths"/"Areas for
          improvement" h3 sections — not a peer of the report's own title. */}
      <h3 className="isdk-score-summary__title" id={headingId}>
        Score Summary
      </h3>
      <p className="isdk-score-summary__total">
        Overall score:{' '}
        <strong className={`isdk-chip isdk-chip--${scoreTier(totalScore)} isdk-tabular`}>
          {totalScore}/100
        </strong>
      </p>
      <table className="isdk-score-summary__table">
        <caption>Score breakdown by rubric dimension</caption>
        <thead>
          <tr>
            <th scope="col">Dimension</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {rubric.dimensions.map((dimension) => {
            const score = Math.round((dimensionAverages[dimension.id] ?? 0) * 100) / 100;
            return (
              <tr key={dimension.id}>
                <th scope="row">{dimension.label}</th>
                <td>
                  <span className={`isdk-chip isdk-chip--${scoreTier(score)} isdk-tabular`}>
                    {score}/100
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
