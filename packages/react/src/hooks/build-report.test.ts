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
  it('returns zeroed totalScore and no dimension averages at all for an empty transcript (nothing was ever assessed)', () => {
    const report = buildReport('session-1', rubric, []);
    expect(report.totalScore).toBe(0);
    expect(report.dimensionAverages).toEqual({});
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

  it('omits a dimension from dimensionAverages entirely when no question in the transcript ever assessed it', () => {
    // Reproduces a real report: a 3-dimension rubric where "systems" never
    // applied to either question asked (see Question.dimensions), so
    // neither evaluation includes a "systems" key at all — previously this
    // would have shown "Systems thinking: 0/100" in the UI, a false,
    // demoralizing failure on something never actually assessed.
    const threeDimensionRubric = defineRubric([
      { id: 'technical', label: 'Technical accuracy', weight: 3 },
      { id: 'communication', label: 'Communication clarity', weight: 1 },
      { id: 'systems', label: 'Systems thinking', weight: 2 },
    ]);
    const report = buildReport('session-1', threeDimensionRubric, [
      entry({ evaluation: evaluation({ dimensionScores: { technical: 10, communication: 10 } }) }),
    ]);

    expect(report.dimensionAverages).toEqual({ technical: 10, communication: 10 });
    expect(report.dimensionAverages).not.toHaveProperty('systems');
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

  it('omits integritySignals entirely when not provided', () => {
    const report = buildReport('session-1', rubric, [entry()]);
    expect(report).not.toHaveProperty('integritySignals');
  });

  it('attaches integritySignals when provided', () => {
    const report = buildReport('session-1', rubric, [entry()], {
      tabSwitchCount: 2,
      tabSwitchTimestamps: [100, 200],
      pasteEvents: [{ length: 500, timestamp: 150 }],
    });
    expect(report.integritySignals).toEqual({
      tabSwitchCount: 2,
      tabSwitchTimestamps: [100, 200],
      pasteEvents: [{ length: 500, timestamp: 150 }],
    });
  });
});
