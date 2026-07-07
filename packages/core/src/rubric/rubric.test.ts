import { describe, expect, it } from 'vitest';
import { RubricValidationError } from '../errors.js';
import { defineRubric, scoreRubric } from './rubric.js';

describe('defineRubric', () => {
  it('fails loud on an empty dimension list', () => {
    expect(() => defineRubric([])).toThrow(RubricValidationError);
  });

  it('fails loud on a missing rubric (undefined dimensions)', () => {
    // @ts-expect-error - intentionally passing an invalid config to prove it fails loud, not silently
    expect(() => defineRubric(undefined)).toThrow(RubricValidationError);
  });

  it('fails loud on a blank dimension id', () => {
    expect(() => defineRubric([{ id: '   ', label: 'Technical', weight: 1 }])).toThrow(
      /missing an id/,
    );
  });

  it('fails loud (not crashes) on a non-string dimension id from an untyped config source', () => {
    expect(() =>
      defineRubric([{ id: 123 as unknown as string, label: 'Technical', weight: 1 }]),
    ).toThrow(/missing an id/);
  });

  it('fails loud on duplicate dimension ids', () => {
    expect(() =>
      defineRubric([
        { id: 'technical', label: 'Technical', weight: 1 },
        { id: 'technical', label: 'Technical again', weight: 1 },
      ]),
    ).toThrow(/Duplicate rubric dimension id/);
  });

  it('fails loud on a zero weight', () => {
    expect(() => defineRubric([{ id: 'technical', label: 'Technical', weight: 0 }])).toThrow(
      /invalid weight/,
    );
  });

  it('fails loud on a negative weight', () => {
    expect(() => defineRubric([{ id: 'technical', label: 'Technical', weight: -1 }])).toThrow(
      /invalid weight/,
    );
  });

  it('fails loud on a NaN weight', () => {
    expect(() => defineRubric([{ id: 'technical', label: 'Technical', weight: NaN }])).toThrow(
      /invalid weight/,
    );
  });

  it('collects every issue in one throw rather than failing on only the first', () => {
    try {
      defineRubric([
        { id: 'a', label: 'A', weight: -1 },
        { id: 'a', label: 'A dup', weight: 1 },
      ]);
      expect.fail('expected defineRubric to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(RubricValidationError);
      const issues = (error as RubricValidationError).issues;
      expect(issues.some((issue) => issue.includes('Duplicate'))).toBe(true);
      expect(issues.some((issue) => issue.includes('invalid weight'))).toBe(true);
    }
  });

  it('normalizes weights so they sum to 1', () => {
    const rubric = defineRubric([
      { id: 'technical', label: 'Technical', weight: 3 },
      { id: 'communication', label: 'Communication', weight: 1 },
    ]);

    expect(rubric.dimensions[0]?.normalizedWeight).toBeCloseTo(0.75);
    expect(rubric.dimensions[1]?.normalizedWeight).toBeCloseTo(0.25);
  });
});

describe('scoreRubric', () => {
  const rubric = defineRubric([
    { id: 'technical', label: 'Technical', weight: 3 },
    { id: 'communication', label: 'Communication', weight: 1 },
  ]);

  it('computes a weighted total from per-dimension scores', () => {
    const result = scoreRubric(rubric, { technical: 80, communication: 40 });
    // 80 * 0.75 + 40 * 0.25 = 70
    expect(result.total).toBeCloseTo(70);
  });

  it('defaults a missing dimension score to 0 rather than throwing', () => {
    const result = scoreRubric(rubric, { technical: 80 });
    expect(result.breakdown.communication?.score).toBe(0);
  });

  it('clamps out-of-range scores into [0, 100]', () => {
    const result = scoreRubric(rubric, { technical: 150, communication: -20 });
    expect(result.breakdown.technical?.score).toBe(100);
    expect(result.breakdown.communication?.score).toBe(0);
  });
});
