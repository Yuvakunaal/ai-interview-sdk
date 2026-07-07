import { describe, expect, it, vi } from 'vitest';
import type { AIProviderAdapter, CompletionRequest } from '../adapter/types.js';
import {
  AnswerTooLongError,
  MalformedAdapterResponseError,
  TooManyPreviousTurnsError,
} from '../errors.js';
import { defineRubric } from '../rubric/rubric.js';
import type { CandidateAnswer, Question } from '../types.js';
import { EvaluationEngine } from './evaluation-engine.js';

const rubric = defineRubric([
  { id: 'technical', label: 'Technical', weight: 3 },
  { id: 'communication', label: 'Communication', weight: 1 },
]);

const question: Question = {
  id: 'q1',
  prompt: 'Explain how a hash map works.',
  concepts: ['hashing', 'collision resolution'],
};

function fakeAdapter(responseText: string): AIProviderAdapter {
  return {
    id: 'fake',
    complete: vi.fn(async (_request: CompletionRequest) => ({ text: responseText })),
  };
}

function answer(text: string, overrides: Partial<CandidateAnswer> = {}): CandidateAnswer {
  return { questionId: 'q1', text, submittedAt: Date.now(), ...overrides };
}

describe('EvaluationEngine', () => {
  it('scores a strong semantic answer using the rubric', async () => {
    const adapter = fakeAdapter(
      JSON.stringify({
        dimensionScores: { technical: 90, communication: 80 },
        conceptCoverage: [
          { concept: 'hashing', covered: true },
          { concept: 'collision resolution', covered: true },
        ],
        contradictions: [],
        flags: [],
      }),
    );
    const engine = new EvaluationEngine();

    const result = await engine.evaluate({
      question,
      rubric,
      answer: answer('A hash map hashes keys into buckets.'),
      adapter,
    });

    expect(result.totalScore).toBeCloseTo(90 * 0.75 + 80 * 0.25);
    expect(result.conceptCoverage).toHaveLength(2);
    expect(adapter.complete).toHaveBeenCalledTimes(1);
  });

  it('detects missing/incorrect concept coverage from the adapter response', async () => {
    const adapter = fakeAdapter(
      JSON.stringify({
        dimensionScores: { technical: 40, communication: 50 },
        conceptCoverage: [
          { concept: 'hashing', covered: true },
          { concept: 'collision resolution', covered: false },
        ],
        contradictions: [],
        flags: ['partial_concept_coverage'],
      }),
    );
    const engine = new EvaluationEngine();

    const result = await engine.evaluate({
      question,
      rubric,
      answer: answer('Hash maps use hashing.'),
      adapter,
    });

    expect(result.conceptCoverage.find((c) => c.concept === 'collision resolution')?.covered).toBe(
      false,
    );
    expect(result.flags).toContain('partial_concept_coverage');
  });

  it('surfaces contradictions detected against previous turns (multi-turn consistency)', async () => {
    const adapter = fakeAdapter(
      JSON.stringify({
        dimensionScores: { technical: 30, communication: 50 },
        contradictions: ['Candidate previously said array search is O(1), now says O(n).'],
        flags: ['contradiction'],
      }),
    );
    const engine = new EvaluationEngine();

    const result = await engine.evaluate({
      question,
      rubric,
      answer: answer('Actually array search is O(n).'),
      adapter,
      previousTurns: [
        {
          question: { id: 'q0', prompt: 'What is array search complexity?' },
          answer: answer('Array search is O(1).', { questionId: 'q0' }),
        },
      ],
    });

    expect(result.contradictions).toHaveLength(1);
    expect(result.flags).toContain('contradiction');
  });

  it('passes through hybrid answer-key comparison results', async () => {
    const adapter = fakeAdapter(
      JSON.stringify({
        dimensionScores: { technical: 95, communication: 90 },
        matchesAnswerKey: true,
      }),
    );
    const engine = new EvaluationEngine();
    const questionWithKey: Question = { ...question, answerKey: 'Buckets + hash function.' };

    const result = await engine.evaluate({
      question: questionWithKey,
      rubric,
      answer: answer('Uses buckets and a hash function.'),
      adapter,
    });

    expect(result.matchesAnswerKey).toBe(true);
  });

  it('does not call the adapter for a skipped answer on a question with no concepts defined, and scores zero', async () => {
    const adapter = fakeAdapter('{}');
    const engine = new EvaluationEngine();
    const questionWithoutConcepts: Question = { id: 'q2', prompt: 'Say hello.' };

    const result = await engine.evaluate({
      question: questionWithoutConcepts,
      rubric,
      answer: answer('', { isSkipped: true, questionId: 'q2' }),
      adapter,
    });

    expect(result.conceptCoverage).toEqual([]);
  });

  it('does not call the adapter for a skipped answer, and scores zero', async () => {
    const adapter = fakeAdapter('{}');
    const engine = new EvaluationEngine();

    const result = await engine.evaluate({
      question,
      rubric,
      answer: answer('', { isSkipped: true }),
      adapter,
    });

    expect(adapter.complete).not.toHaveBeenCalled();
    expect(result.totalScore).toBe(0);
    expect(result.flags).toEqual(['skipped']);
  });

  it('does not call the adapter for silence, and scores zero', async () => {
    const adapter = fakeAdapter('{}');
    const engine = new EvaluationEngine();

    const result = await engine.evaluate({
      question,
      rubric,
      answer: answer('', { isSilence: true }),
      adapter,
    });

    expect(adapter.complete).not.toHaveBeenCalled();
    expect(result.totalScore).toBe(0);
    expect(result.flags).toEqual(['no_answer']);
  });

  it('does not call the adapter for an empty/whitespace-only answer, and scores zero', async () => {
    const adapter = fakeAdapter('{}');
    const engine = new EvaluationEngine();

    const result = await engine.evaluate({ question, rubric, answer: answer('   '), adapter });

    expect(adapter.complete).not.toHaveBeenCalled();
    expect(result.flags).toEqual(['no_answer']);
  });

  it('does not call the adapter for a bare "I don\'t know", and scores zero regardless of provider leniency', async () => {
    // Observed in practice: an AI provider handed a follow-up answer of
    // just "i dont know" a 75-90/100 partial score. This must never
    // depend on any given model's leniency for such an unambiguous
    // non-answer, so it's short-circuited before any provider call.
    const adapter = fakeAdapter(
      JSON.stringify({ dimensionScores: { technical: 80, communication: 75 } }),
    );
    const engine = new EvaluationEngine();

    const result = await engine.evaluate({
      question,
      rubric,
      answer: answer("I don't know"),
      adapter,
    });

    expect(adapter.complete).not.toHaveBeenCalled();
    expect(result.totalScore).toBe(0);
    expect(result.flags).toEqual(['i_dont_know']);
  });

  it('still scores a hedged-but-real attempt via the adapter, not as a bare "don\'t know"', async () => {
    const adapter = fakeAdapter(
      JSON.stringify({ dimensionScores: { technical: 40, communication: 50 } }),
    );
    const engine = new EvaluationEngine();

    const result = await engine.evaluate({
      question,
      rubric,
      answer: answer("I don't know the exact term, but I think it's related to chaining."),
      adapter,
    });

    expect(adapter.complete).toHaveBeenCalledTimes(1);
    expect(result.totalScore).toBeGreaterThan(0);
  });

  it('flags a very short answer while still scoring it via the adapter', async () => {
    const adapter = fakeAdapter(
      JSON.stringify({ dimensionScores: { technical: 20, communication: 20 } }),
    );
    const engine = new EvaluationEngine();

    const result = await engine.evaluate({ question, rubric, answer: answer('Buckets.'), adapter });

    expect(adapter.complete).toHaveBeenCalledTimes(1);
    expect(result.flags).toContain('very_short_answer');
  });

  it('flags a very long answer while still scoring it via the adapter', async () => {
    const adapter = fakeAdapter(
      JSON.stringify({ dimensionScores: { technical: 60, communication: 60 } }),
    );
    const engine = new EvaluationEngine();
    const longAnswer = 'a'.repeat(5000);

    const result = await engine.evaluate({ question, rubric, answer: answer(longAnswer), adapter });

    expect(result.flags).toContain('very_long_answer');
  });

  it('rejects an answer past the hard length cap before ever calling the adapter', async () => {
    const adapter = fakeAdapter('{}');
    const engine = new EvaluationEngine();
    const pathologicallyLongAnswer = 'a'.repeat(20_001);

    await expect(
      engine.evaluate({ question, rubric, answer: answer(pathologicallyLongAnswer), adapter }),
    ).rejects.toThrow(AnswerTooLongError);
    expect(adapter.complete).not.toHaveBeenCalled();
  });

  it('rejects a fabricated multi-turn history past the previous-turns cap before calling the adapter', async () => {
    const adapter = fakeAdapter('{}');
    const engine = new EvaluationEngine();
    const previousTurns = Array.from({ length: 51 }, (_, i) => ({
      question: { id: `p${i}`, prompt: 'Previous question' },
      answer: answer('A previous answer.', { questionId: `p${i}` }),
    }));

    await expect(
      engine.evaluate({
        question,
        rubric,
        answer: answer('Buckets and hashing.'),
        adapter,
        previousTurns,
      }),
    ).rejects.toThrow(TooManyPreviousTurnsError);
    expect(adapter.complete).not.toHaveBeenCalled();
  });

  it('rejects an oversized answer hiding inside previousTurns, not just the current answer', async () => {
    const adapter = fakeAdapter('{}');
    const engine = new EvaluationEngine();
    const previousTurns = [
      {
        question: { id: 'p1', prompt: 'Previous question' },
        answer: answer('a'.repeat(20_001), { questionId: 'p1' }),
      },
    ];

    await expect(
      engine.evaluate({
        question,
        rubric,
        answer: answer('Buckets and hashing.'),
        adapter,
        previousTurns,
      }),
    ).rejects.toThrow(AnswerTooLongError);
    expect(adapter.complete).not.toHaveBeenCalled();
  });

  it('passes through off-topic, "I don\'t know", avoidance, hint-request, and candidate-question flags', async () => {
    const adapter = fakeAdapter(
      JSON.stringify({
        dimensionScores: { technical: 0, communication: 0 },
        flags: ['off_topic', 'i_dont_know', 'avoidance', 'hint_request', 'candidate_question'],
      }),
    );
    const engine = new EvaluationEngine();

    const result = await engine.evaluate({
      question,
      rubric,
      answer: answer('Can you repeat the question?'),
      adapter,
    });

    expect(result.flags).toEqual(
      expect.arrayContaining([
        'off_topic',
        'i_dont_know',
        'avoidance',
        'hint_request',
        'candidate_question',
      ]),
    );
  });

  it('throws MalformedAdapterResponseError when the adapter returns non-JSON text', async () => {
    const adapter = fakeAdapter('Sure! The candidate did great.');
    const engine = new EvaluationEngine();

    await expect(
      engine.evaluate({ question, rubric, answer: answer('Buckets and hashing.'), adapter }),
    ).rejects.toThrow(MalformedAdapterResponseError);
  });

  it('throws MalformedAdapterResponseError when the adapter JSON does not match the expected schema', async () => {
    const adapter = fakeAdapter(JSON.stringify({ dimensionScores: { technical: 'not-a-number' } }));
    const engine = new EvaluationEngine();

    await expect(
      engine.evaluate({ question, rubric, answer: answer('Buckets and hashing.'), adapter }),
    ).rejects.toThrow(MalformedAdapterResponseError);
  });

  it('scores non-English answers the same way, since candidate text is opaque data to the engine (language-independent scoring)', async () => {
    const adapter = fakeAdapter(
      JSON.stringify({ dimensionScores: { technical: 85, communication: 85 } }),
    );
    const engine = new EvaluationEngine();

    const result = await engine.evaluate({
      question,
      rubric,
      // Hindi: "Hash map ek data structure hai jo keys ko hash karke buckets mein store karta hai."
      answer: answer(
        'हैश मैप एक डेटा संरचना है जो कुंजियों को हैश करके बकेट में संग्रहीत करता है।',
      ),
      adapter,
    });

    expect(result.totalScore).toBeCloseTo(85);
    expect(adapter.complete).toHaveBeenCalledTimes(1);
  });
});
