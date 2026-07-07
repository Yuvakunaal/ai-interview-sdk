import type { Rubric } from '@interview-sdk/core';
import type { TranscriptEntry } from '../hooks/build-report.js';

export interface LiveSignalsProps {
  rubric: Rubric;
  transcript: TranscriptEntry[];
}

/**
 * Live per-dimension score bars for the most recently answered question —
 * reads straight from the latest transcript entry's real dimensionScores,
 * the same evaluation data ScoreSummary uses for the final report. Renders
 * nothing until at least one answer has been scored.
 */
export function LiveSignals({ rubric, transcript }: LiveSignalsProps) {
  const latest = transcript.at(-1);
  if (!latest) return null;

  return (
    <div className="isdk-live-signals" role="log" aria-live="polite">
      <p className="isdk-kicker">Live signals</p>
      <ul className="isdk-live-signals__list">
        {rubric.dimensions.map((dimension) => {
          const score = latest.evaluation.dimensionScores[dimension.id];
          if (score === undefined) return null;
          const clamped = Math.min(100, Math.max(0, score));

          return (
            <li key={dimension.id} className="isdk-live-signals__row">
              <span className="isdk-live-signals__label">{dimension.label}</span>
              <span
                className="isdk-live-signals__bar"
                role="img"
                aria-label={`${dimension.label}: ${Math.round(clamped)} out of 100`}
              >
                <span className="isdk-live-signals__fill" style={{ width: `${clamped}%` }} />
              </span>
              <span className="isdk-live-signals__score isdk-tabular">{Math.round(clamped)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
