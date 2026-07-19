import type { Rubric } from '@interview-sdk/core';
import { STRENGTH_THRESHOLD, type TranscriptEntry } from '../hooks/build-report.js';

export interface LiveSignalsProps {
  rubric: Rubric;
  transcript: TranscriptEntry[];
}

/**
 * Live per-dimension score meters for the most recently answered question —
 * reads straight from the latest transcript entry's real dimensionScores,
 * the same evaluation data ScoreSummary uses for the final report. Renders
 * nothing until at least one answer has been scored.
 *
 * Styled as a vertical instrument cluster (think a mixing console's level
 * meters) rather than the horizontal "skill bar" almost every scoring UI
 * defaults to — each meter also carries a real tick at STRENGTH_THRESHOLD,
 * the same cutoff the final report uses to call a dimension a strength, so
 * "does this clear the bar" reads at a glance instead of requiring the
 * candidate or reviewer to do the comparison themselves.
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
            <li key={dimension.id} className="isdk-live-signals__meter">
              <span className="isdk-live-signals__score isdk-tabular">{Math.round(clamped)}</span>
              <span
                className="isdk-live-signals__track"
                role="img"
                aria-label={`${dimension.label}: ${Math.round(clamped)} out of 100`}
              >
                <span
                  className="isdk-live-signals__threshold"
                  style={{ bottom: `${STRENGTH_THRESHOLD}%` }}
                />
                <span
                  className={
                    clamped >= STRENGTH_THRESHOLD
                      ? 'isdk-live-signals__fill isdk-live-signals__fill--pass'
                      : 'isdk-live-signals__fill'
                  }
                  style={{ height: `${clamped}%` }}
                />
              </span>
              <span className="isdk-live-signals__label">{dimension.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
