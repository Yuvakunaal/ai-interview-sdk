import type { EvaluationResult, Question, Rubric } from '@interview-sdk/core';
import { defineRubric } from '@interview-sdk/core';
import { describe, expect, it } from 'vitest';
import { buildReport, type TranscriptEntry } from './build-report.js';

const rubric: Rubric = defineRubric([
  { id: 'technical', label: 'Technical', weight: 3 },
  { id: 'communication', label: 'Communication', weight: 1 },
]);

const question: Question = {
  id: 'q1',
  prompt: 'Explain hash maps.',
  concepts: ['hashing', 'collisions'],
};

function evaluation(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    questionId: 'q1',
    dimensionScores: { technical: 80, communication: 80 },
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
    answer: { questionId: 'q1', text: 'buckets', submittedAt: 1 },
    evaluation: evaluation(),
    ...overrides,
  };
}

describe('buildReport', () => {
  it('returns zeroed fields for an empty transcript', () => {
    const report = buildReport('session-1', rubric, []);
    expect(report.totalScore).toBe(0);
    expect(report.dimensionAverages).toEqual({ technical: 0, communication: 0 });
    expect(report.strengths).toEqual([]);
    expect(report.weaknesses).toEqual([]);
  });

  it('averages totalScore across the transcript', () => {
    const report = buildReport('session-1', rubric, [
      entry({ evaluation: evaluation({ totalScore: 60 }) }),
      entry({ evaluation: evaluation({ totalScore: 100 }) }),
    ]);
    expect(report.totalScore).toBeCloseTo(80);
  });

  it('averages each rubric dimension independently', () => {
    const report = buildReport('session-1', rubric, [
      entry({ evaluation: evaluation({ dimensionScores: { technical: 90, communication: 50 } }) }),
      entry({ evaluation: evaluation({ dimensionScores: { technical: 70, communication: 30 } }) }),
    ]);
    expect(report.dimensionAverages.technical).toBeCloseTo(80);
    expect(report.dimensionAverages.communication).toBeCloseTo(40);
  });

  it('flags a dimension as a strength when its average is high', () => {
    const report = buildReport('session-1', rubric, [
      entry({ evaluation: evaluation({ dimensionScores: { technical: 90, communication: 90 } }) }),
    ]);
    expect(report.strengths).toEqual(['Technical', 'Communication']);
    expect(report.weaknesses).toEqual([]);
  });

  it('flags a dimension as a weakness when its average is low', () => {
    const report = buildReport('session-1', rubric, [
      entry({ evaluation: evaluation({ dimensionScores: { technical: 20, communication: 20 } }) }),
    ]);
    expect(report.weaknesses).toEqual(['Technical', 'Communication']);
    expect(report.strengths).toEqual([]);
  });

  it('collects unique missed concepts across the transcript', () => {
    const report = buildReport('session-1', rubric, [
      entry({
        evaluation: evaluation({
          conceptCoverage: [
            { concept: 'hashing', covered: true },
            { concept: 'collisions', covered: false },
          ],
        }),
      }),
      entry({
        evaluation: evaluation({
          conceptCoverage: [{ concept: 'collisions', covered: false }],
        }),
      }),
    ]);
    expect(report.missedConcepts).toEqual(['collisions']);
  });

  it('carries the sessionId and full transcript through unchanged', () => {
    const transcript = [entry()];
    const report = buildReport('session-42', rubric, transcript);
    expect(report.sessionId).toBe('session-42');
    expect(report.transcript).toBe(transcript);
  });
});
