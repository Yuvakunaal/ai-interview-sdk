import type { CandidateAnswer, EvaluationResult, Question, Rubric } from '@interview-sdk/core';

export interface TranscriptEntry {
  question: Question;
  prompt: string;
  isFollowUp: boolean;
  answer: CandidateAnswer;
  evaluation: EvaluationResult;
}

export interface InterviewReport {
  sessionId: string;
  totalScore: number;
  dimensionAverages: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  missedConcepts: string[];
  transcript: TranscriptEntry[];
}

const STRENGTH_THRESHOLD = 75;
const WEAKNESS_THRESHOLD = 40;

/**
 * Builds a heuristic report from rubric scores and concept coverage already
 * present in the transcript. Strengths/weaknesses/recommendations are
 * derived from dimension averages and missed concepts, not AI-generated
 * commentary — there is no such call in this SDK today.
 */
export function buildReport(
  sessionId: string,
  rubric: Rubric,
  transcript: TranscriptEntry[],
): InterviewReport {
  const dimensionAverages: Record<string, number> = {};
  const dimensionsWithData = new Set<string>();
  for (const dimension of rubric.dimensions) {
    const scores = transcript
      .map((entry) => entry.evaluation.dimensionScores[dimension.id])
      .filter((score): score is number => typeof score === 'number');
    if (scores.length > 0) dimensionsWithData.add(dimension.id);
    dimensionAverages[dimension.id] =
      scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  }

  const totalScore =
    transcript.length > 0
      ? transcript.reduce((sum, entry) => sum + entry.evaluation.totalScore, 0) / transcript.length
      : 0;

  const dimensionsWithScores = rubric.dimensions.filter((dimension) =>
    dimensionsWithData.has(dimension.id),
  );

  const strengths = dimensionsWithScores
    .filter((dimension) => (dimensionAverages[dimension.id] ?? 0) >= STRENGTH_THRESHOLD)
    .map((dimension) => dimension.label);

  const weaknesses = dimensionsWithScores
    .filter((dimension) => (dimensionAverages[dimension.id] ?? 0) <= WEAKNESS_THRESHOLD)
    .map((dimension) => dimension.label);

  const missedConcepts = Array.from(
    new Set(
      transcript.flatMap((entry) =>
        entry.evaluation.conceptCoverage.filter((c) => !c.covered).map((c) => c.concept),
      ),
    ),
  );

  return {
    sessionId,
    totalScore: Math.round(totalScore * 100) / 100,
    dimensionAverages,
    strengths,
    weaknesses,
    missedConcepts,
    transcript,
  };
}
