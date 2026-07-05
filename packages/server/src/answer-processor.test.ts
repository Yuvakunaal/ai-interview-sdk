import type { AIProviderAdapter, CandidateAnswer, Question } from '@interview-sdk/core';
import { describe, expect, it, vi } from 'vitest';
import { ServerAnswerProcessor, type ProcessAnswerRequestBody } from './answer-processor.js';
import { UnknownQuestionIdError } from './errors.js';
import { verify } from './signing.js';

const questions: Question[] = [
  { id: 'q1', prompt: 'Explain hash maps.', concepts: ['hashing'] },
  { id: 'q2', prompt: 'Explain binary search.' },
];

const rubric = [{ id: 'technical', label: 'Technical', weight: 1 }];

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

function baseBody(overrides: Partial<ProcessAnswerRequestBody> = {}): ProcessAnswerRequestBody {
  return { answer, ...overrides };
}

describe('ServerAnswerProcessor', () => {
  it('evaluates the answer and returns no follow-up when the concept is fully covered', async () => {
    const adapter = fakeAdapter([
      JSON.stringify({
        dimensionScores: { technical: 95 },
        conceptCoverage: [{ concept: 'hashing', covered: true }],
      }),
    ]);
    const processor = new ServerAnswerProcessor({ questions, rubric, adapter });

    const result = await processor.processAnswer(baseBody());

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
        prompt: 'Can you say more about hashing?',
        targetsMissedConcepts: ['hashing'],
      }),
    ]);
    const processor = new ServerAnswerProcessor({ questions, rubric, adapter });

    const result = await processor.processAnswer(baseBody());

    expect(result.followUp?.prompt).toBe('Can you say more about hashing?');
  });

  it('ignores a client-supplied question/rubric and scores against its own configured versions', async () => {
    const adapter = fakeAdapter([
      JSON.stringify({
        dimensionScores: { technical: 95 },
        conceptCoverage: [{ concept: 'hashing', covered: true }],
      }),
    ]);
    const processor = new ServerAnswerProcessor({ questions, rubric, adapter });

    const tamperedQuestion: Question = { id: 'q1', prompt: 'Explain hash maps.', concepts: [] };
    const tamperedRubric = {
      dimensions: [{ id: 'technical', label: 'x', weight: 1, normalizedWeight: 1 }],
    };

    await processor.processAnswer(baseBody({ question: tamperedQuestion, rubric: tamperedRubric }));

    const sentRequest = (adapter.complete as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    const userMessage = JSON.stringify(sentRequest);
    expect(userMessage).toContain('hashing');
  });

  it('throws UnknownQuestionIdError for an answer.questionId not in the configured question bank', async () => {
    const adapter = fakeAdapter(['{}']);
    const processor = new ServerAnswerProcessor({ questions, rubric, adapter });

    await expect(
      processor.processAnswer(baseBody({ answer: { ...answer, questionId: 'does-not-exist' } })),
    ).rejects.toThrow(UnknownQuestionIdError);
  });

  it('signs the evaluation when a signingSecret is configured, and the signature verifies', async () => {
    const adapter = fakeAdapter([JSON.stringify({ dimensionScores: { technical: 90 } })]);
    const processor = new ServerAnswerProcessor({
      questions,
      rubric,
      adapter,
      signingSecret: 'shh',
    });

    const result = await processor.processAnswer(baseBody());
    const { signature, ...evaluation } = result.evaluation as { signature: string };

    expect(typeof signature).toBe('string');
    expect(verify(evaluation, signature, 'shh')).toBe(true);
  });

  it('does not attach a signature when no signingSecret is configured', async () => {
    const adapter = fakeAdapter([JSON.stringify({ dimensionScores: { technical: 90 } })]);
    const processor = new ServerAnswerProcessor({ questions, rubric, adapter });

    const result = await processor.processAnswer(baseBody());

    expect(result.evaluation).not.toHaveProperty('signature');
  });

  it('short-circuits without calling the adapter for a skipped answer', async () => {
    const adapter = fakeAdapter(['{}']);
    const processor = new ServerAnswerProcessor({ questions, rubric, adapter });

    const result = await processor.processAnswer(
      baseBody({ answer: { ...answer, text: '', isSkipped: true } }),
    );

    expect(adapter.complete).not.toHaveBeenCalled();
    expect(result.evaluation.totalScore).toBe(0);
  });

  it('fails loud at construction time on an invalid rubric', () => {
    const adapter = fakeAdapter(['{}']);
    expect(
      () =>
        new ServerAnswerProcessor({
          questions,
          rubric: [{ id: 'technical', label: 'Technical', weight: -1 }],
          adapter,
        }),
    ).toThrow(/Invalid interview configuration/);
  });
});
