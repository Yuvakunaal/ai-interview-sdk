import { describe, expect, it } from 'vitest';
import { canonicalize, sign, verify } from './signing.js';

describe('canonicalize', () => {
  it('produces identical output regardless of key insertion order', () => {
    const a = { b: 2, a: 1, nested: { y: 2, x: 1 } };
    const b = { a: 1, nested: { x: 1, y: 2 }, b: 2 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('preserves array order', () => {
    expect(canonicalize([1, 2, 3])).not.toBe(canonicalize([3, 2, 1]));
  });

  it('treats a key explicitly set to undefined the same as an absent key', () => {
    // The real-world case: EvaluationResult's optional fields are built via
    // object-literal assignment (e.g. `rationale: parsed.rationale`), so
    // they're present as an explicit key even when the AI provider didn't
    // return that field — unlike an object where the key was simply never
    // set.
    const withExplicitUndefined = { questionId: 'q1', rationale: undefined };
    const withoutTheKeyAtAll = { questionId: 'q1' };
    expect(canonicalize(withExplicitUndefined)).toBe(canonicalize(withoutTheKeyAtAll));
  });
});

describe('sign / verify', () => {
  const payload = { questionId: 'q1', totalScore: 88 };

  it('verifies a signature produced for the same payload and secret', () => {
    const signature = sign(payload, 'secret');
    expect(verify(payload, signature, 'secret')).toBe(true);
  });

  it('rejects a signature checked against a different payload', () => {
    const signature = sign(payload, 'secret');
    expect(verify({ ...payload, totalScore: 100 }, signature, 'secret')).toBe(false);
  });

  it('rejects a signature checked against a different secret', () => {
    const signature = sign(payload, 'secret');
    expect(verify(payload, signature, 'wrong-secret')).toBe(false);
  });

  it('is insensitive to key insertion order in the payload being verified', () => {
    const signature = sign({ a: 1, b: 2 }, 'secret');
    expect(verify({ b: 2, a: 1 }, signature, 'secret')).toBe(true);
  });

  it('rejects a garbage (non-hex, wrong-length) signature without throwing', () => {
    expect(verify(payload, 'not-a-real-signature', 'secret')).toBe(false);
  });

  it('verifies an EvaluationResult-shaped payload after a real JSON round-trip, even when the AI provider omitted optional fields', () => {
    // Reproduces the actual bug found testing this against a real AI
    // provider (Groq): EvaluationResult's optional fields are assigned as
    // `matchesAnswerKey: parsed.matchesAnswerKey` — present as an explicit
    // key even when the model's response didn't include that field, so the
    // in-memory object signed by /api/interview/answer has keys a plain
    // object built from a real HTTP JSON response (after
    // /api/interview/complete parses it back) will never have. Every real
    // caller signs server-side, ships the value to the browser as JSON, and
    // re-verifies it server-side later — so a signature that only verifies
    // against the exact in-memory object, and not its JSON round-trip, is
    // useless in practice.
    const evaluationAsConstructedInMemory = {
      questionId: 'q3',
      dimensionScores: { technical: 75 },
      totalScore: 75,
      conceptCoverage: [{ concept: 'rows', covered: true, partial: undefined }],
      contradictions: [],
      flags: [],
      matchesAnswerKey: undefined,
      rationale: undefined,
    };
    const signature = sign(evaluationAsConstructedInMemory, 'secret');

    const evaluationAfterJsonRoundTrip = JSON.parse(
      JSON.stringify(evaluationAsConstructedInMemory),
    ) as Record<string, unknown>;

    expect(verify(evaluationAfterJsonRoundTrip, signature, 'secret')).toBe(true);
  });
});
