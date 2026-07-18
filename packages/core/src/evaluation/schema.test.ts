import { describe, expect, it } from 'vitest';
import { evaluationResponseSchema } from './schema.js';

const minimalValidResponse = { dimensionScores: { technical: 80 } };

describe('evaluationResponseSchema', () => {
  it('parses a fully well-formed response', () => {
    const result = evaluationResponseSchema.parse({
      dimensionScores: { technical: 80 },
      conceptCoverage: [{ concept: 'hashing', covered: true }],
      contradictions: ['said X then Y'],
      flags: ['off_topic'],
      matchesAnswerKey: true,
      rationale: 'Solid answer.',
    });
    expect(result.contradictions).toEqual(['said X then Y']);
    expect(result.flags).toEqual(['off_topic']);
    expect(result.matchesAnswerKey).toBe(true);
  });

  it('defaults contradictions/flags/conceptCoverage to [] when omitted', () => {
    const result = evaluationResponseSchema.parse(minimalValidResponse);
    expect(result.contradictions).toEqual([]);
    expect(result.flags).toEqual([]);
    expect(result.conceptCoverage).toEqual([]);
    expect(result.matchesAnswerKey).toBeUndefined();
  });

  // Reproduces real, repeated responses from Groq's llama-3.1-8b-instant
  // (verified via the CLI's `simulate` command against a live model — this
  // failed 3 of 4 real runs before this fix): the model returns `null` for
  // an unset optional field instead of omitting it, which previously threw
  // a hard schema-validation error over an auxiliary field, discarding an
  // otherwise perfectly good evaluation.
  it('treats a real "contradictions: null" response the same as omitted, not a validation error', () => {
    const result = evaluationResponseSchema.parse({ ...minimalValidResponse, contradictions: null });
    expect(result.contradictions).toEqual([]);
  });

  it('treats a real "matchesAnswerKey: null" response the same as omitted, not a validation error', () => {
    const result = evaluationResponseSchema.parse({ ...minimalValidResponse, matchesAnswerKey: null });
    expect(result.matchesAnswerKey).toBeUndefined();
  });

  it('treats a real "rationale: null" response the same as omitted, not a validation error', () => {
    const result = evaluationResponseSchema.parse({ ...minimalValidResponse, rationale: null });
    expect(result.rationale).toBeUndefined();
  });

  it('treats a real "conceptCoverage: null" response (the whole field, not just an entry) the same as omitted', () => {
    const result = evaluationResponseSchema.parse({ ...minimalValidResponse, conceptCoverage: null });
    expect(result.conceptCoverage).toEqual([]);
  });

  it('wraps a real bare-string "contradictions" response (instead of an array) into a one-item array', () => {
    const result = evaluationResponseSchema.parse({
      ...minimalValidResponse,
      contradictions: 'said the loop was O(1) then O(n)',
    });
    expect(result.contradictions).toEqual(['said the loop was O(1) then O(n)']);
  });

  it('wraps a bare-string "flags" response into a one-item array, still validated against the enum', () => {
    const result = evaluationResponseSchema.parse({ ...minimalValidResponse, flags: 'off_topic' });
    expect(result.flags).toEqual(['off_topic']);
  });

  it('drops a genuinely invalid/hallucinated flag value instead of failing the whole evaluation', () => {
    // Reproduced against a real Groq response: one of the returned flag
    // strings didn't match any real flag enum member (the model invented
    // one). There's no safe value to coerce a made-up flag into, so it's
    // dropped rather than kept, coerced, or allowed to crash parsing.
    const result = evaluationResponseSchema.parse({
      ...minimalValidResponse,
      flags: ['off_topic', 'not_a_real_flag', 'i_dont_know'],
    });
    expect(result.flags).toEqual(['off_topic', 'i_dont_know']);
  });

  it('still rejects a non-boolean, non-null matchesAnswerKey (e.g. a string) as a genuine validation error', () => {
    expect(() =>
      evaluationResponseSchema.parse({ ...minimalValidResponse, matchesAnswerKey: 'yes' }),
    ).toThrow();
  });

  it('defaults a real "conceptCoverage[].covered: undefined" entry to false instead of failing the whole evaluation', () => {
    // Reproduced against a real Groq response: the model named the
    // concept but omitted `covered` entirely for that entry.
    const result = evaluationResponseSchema.parse({
      ...minimalValidResponse,
      conceptCoverage: [{ concept: 'hashing' }],
    });
    expect(result.conceptCoverage).toEqual([{ concept: 'hashing', covered: false }]);
  });

  it('treats a real "conceptCoverage[].partial: null" entry the same as omitted, not a validation error', () => {
    // Reproduced against a real Groq response: the model included a
    // `partial` key set to `null` rather than omitting it or using a
    // real boolean.
    const result = evaluationResponseSchema.parse({
      ...minimalValidResponse,
      conceptCoverage: [{ concept: 'hashing', covered: true, partial: null }],
    });
    expect(result.conceptCoverage).toEqual([{ concept: 'hashing', covered: true, partial: undefined }]);
  });

  it('drops a real "conceptCoverage[].concept: null" entry instead of failing the whole evaluation', () => {
    // Also reproduced against a real Groq response during the same
    // `simulate` run — a concept-coverage entry with no concept name is
    // unusable (nothing downstream could act on it), so it's dropped
    // rather than coerced into a fake value or allowed to crash parsing.
    const result = evaluationResponseSchema.parse({
      ...minimalValidResponse,
      conceptCoverage: [
        { concept: 'hashing', covered: true },
        { concept: null, covered: true },
      ],
    });
    expect(result.conceptCoverage).toEqual([{ concept: 'hashing', covered: true }]);
  });
});
