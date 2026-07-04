import type { EvaluationResult, Question } from '@interview-sdk/core';
import { describe, expect, it, vi } from 'vitest';
import type { TranscriptEntry } from '../hooks/build-report.js';
import { downloadBlob, transcriptToCsv } from './report-export.js';

const question: Question = { id: 'q1', prompt: 'Explain hash maps.' };

function evaluation(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    questionId: 'q1',
    dimensionScores: { technical: 80 },
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
    answer: { questionId: 'q1', text: 'It uses buckets.', submittedAt: 1 },
    evaluation: evaluation(),
    ...overrides,
  };
}

describe('transcriptToCsv', () => {
  it('includes a header row and one row per transcript entry', () => {
    const csv = transcriptToCsv([entry()]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('question,prompt,isFollowUp,answer,score');
    expect(lines[1]).toBe('q1,Explain hash maps.,false,It uses buckets.,80');
  });

  it('quotes and escapes fields containing commas, quotes, or newlines', () => {
    const csv = transcriptToCsv([
      entry({
        answer: { questionId: 'q1', text: 'Uses "buckets", and chaining.', submittedAt: 1 },
      }),
    ]);
    expect(csv).toContain('"Uses ""buckets"", and chaining."');
  });

  it('returns just the header for an empty transcript', () => {
    expect(transcriptToCsv([])).toBe('question,prompt,isFollowUp,answer,score');
  });
});

describe('downloadBlob', () => {
  it('creates an object URL, clicks a temporary anchor, and revokes the URL', () => {
    const createObjectURL = vi.fn(() => 'blob:fake-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlob(new Blob(['data']), 'report.json');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
