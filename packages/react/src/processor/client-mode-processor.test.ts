import type { AIProviderAdapter, CandidateAnswer, Question, Rubric } from '@interview-sdk/core';
import { defineRubric } from '@interview-sdk/core';
import { describe, expect, it, vi } from 'vitest';
import { ClientModeProcessor } from './client-mode-processor.js';
import type { ProcessAnswerInput } from './types.js';

const rubric: Rubric = defineRubric([{ id: 'technical', label: 'Technical', weight: 1 }]);
const question: Question = { id: 'q1', prompt: 'Explain hash maps.', concepts: ['hashing'] };
const answer: CandidateAnswer = { questionId: 'q1', text: 'It uses buckets.', submittedAt: 1 };

function fakeAdapter(responses: string[]): AIProviderAdapter {
  let call = 0;
  return {
    id: 'fake',
    complete: vi.fn(async () => {
      const text = responses[Math.min(call, responses.length - 1)] ?? '{}';
      call += 1;
      return { text };
    }),
  };
}

function baseInput(overrides: Partial<ProcessAnswerInput> = {}): ProcessAnswerInput {
  return {
    question,
    rubric,
    answer,
    previousTurns: [],
    currentFollowUpDepth: 0,
    askedFollowUps: [],
    ...overrides,
  };
}

describe('ClientModeProcessor', () => {
  it('evaluates the answer and returns no follow-up when the concept is fully covered', async () => {
    const adapter = fakeAdapter([
      JSON.stringify({
        dimensionScores: { technical: 95 },
        conceptCoverage: [{ concept: 'hashing', covered: true }],
      }),
    ]);
    const processor = new ClientModeProcessor(adapter);

    const result = await processor.processAnswer(baseInput());

    expect(result.evaluation.totalScore).toBeCloseTo(95);
    expect(result.followUp).toBeUndefined();
  });

  it('generates a follow-up when concepts are missing', async () => {
    const adapter = fakeAdapter([
      JSON.stringify({
        dimensionScores: { technical: 40 },
        conceptCoverage: [{ concept: 'hashing', covered: false }],
      }),
      JSON.stringify({
        prompt: 'Can you explain hashing specifically?',
        targetsMissedConcepts: ['hashing'],
      }),
    ]);
    const processor = new ClientModeProcessor(adapter);

    const result = await processor.processAnswer(baseInput());

    expect(result.followUp?.prompt).toBe('Can you explain hashing specifically?');
  });

  it('respects a configured maxFollowUpDepth', async () => {
    const adapter = fakeAdapter([
      JSON.stringify({
        dimensionScores: { technical: 40 },
        conceptCoverage: [{ concept: 'hashing', covered: false }],
      }),
    ]);
    const processor = new ClientModeProcessor(adapter, { maxDepth: 1 });

    const result = await processor.processAnswer(baseInput({ currentFollowUpDepth: 1 }));

    expect(result.followUp).toBeUndefined();
  });

  it('short-circuits without calling the adapter for a skipped answer', async () => {
    const adapter = fakeAdapter(['{}']);
    const processor = new ClientModeProcessor(adapter);

    const result = await processor.processAnswer(
      baseInput({ answer: { ...answer, text: '', isSkipped: true } }),
    );

    expect(adapter.complete).not.toHaveBeenCalled();
    expect(result.evaluation.totalScore).toBe(0);
  });
});
