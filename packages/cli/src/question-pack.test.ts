import { describe, expect, it } from 'vitest';
import { createStarterQuestionPack, validateQuestionPack } from './question-pack.js';

function validPack() {
  return {
    name: 'dsa-fundamentals',
    questions: [
      { id: 'q1', prompt: 'Explain hash maps.', concepts: ['hashing'] },
      { id: 'q2', prompt: 'Explain binary search.' },
    ],
    rubric: [{ id: 'technical', label: 'Technical', weight: 1 }],
  };
}

describe('validateQuestionPack', () => {
  it('accepts a well-formed pack', () => {
    const result = validateQuestionPack(validPack());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.pack?.name).toBe('dsa-fundamentals');
  });

  it('rejects a pack with no questions', () => {
    const result = validateQuestionPack({ ...validPack(), questions: [] });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('rejects a pack missing a rubric', () => {
    const pack = validPack() as Record<string, unknown>;
    delete pack.rubric;
    const result = validateQuestionPack(pack);
    expect(result.valid).toBe(false);
  });

  it('flags duplicate question ids', () => {
    const pack = validPack();
    pack.questions = [...pack.questions, { id: 'q1', prompt: 'Duplicate id question.' }];
    const result = validateQuestionPack(pack);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.includes('Duplicate question id'))).toBe(true);
  });

  it('flags duplicate rubric dimension ids', () => {
    const pack = validPack();
    pack.rubric = [...pack.rubric, { id: 'technical', label: 'Technical again', weight: 1 }];
    const result = validateQuestionPack(pack);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.includes('Duplicate rubric dimension id'))).toBe(
      true,
    );
  });

  it('flags a conceptMap entry with no matching question concept', () => {
    const pack = { ...validPack(), conceptMap: { 'never-declared': 'orphaned entry' } };
    const result = validateQuestionPack(pack);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.includes('never-declared'))).toBe(true);
  });

  it('accepts a conceptMap whose entries all match declared concepts', () => {
    const pack = { ...validPack(), conceptMap: { hashing: 'How keys map to buckets.' } };
    const result = validateQuestionPack(pack);
    expect(result.valid).toBe(true);
  });

  it('rejects a non-object input', () => {
    const result = validateQuestionPack('not a pack');
    expect(result.valid).toBe(false);
  });
});

describe('createStarterQuestionPack', () => {
  it('produces a pack that validates cleanly', () => {
    const starter = createStarterQuestionPack('my-pack');
    const result = validateQuestionPack(starter);
    expect(result.valid).toBe(true);
    expect(starter.name).toBe('my-pack');
  });
});
