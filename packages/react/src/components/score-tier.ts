export type ScoreTier = 'pass' | 'flag' | 'neutral';

// Same cutoffs build-report.ts uses to classify strengths (>=75) and
// weaknesses (<=40), so a score reads the same color whether it's on the
// transcript, the score table, or the strengths/weaknesses list.
const PASS_THRESHOLD = 75;
const FLAG_THRESHOLD = 40;

export function scoreTier(score: number): ScoreTier {
  if (score >= PASS_THRESHOLD) return 'pass';
  if (score <= FLAG_THRESHOLD) return 'flag';
  return 'neutral';
}
