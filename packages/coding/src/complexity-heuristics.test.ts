import { describe, expect, it } from 'vitest';
import { checkEmpiricalComplexity, checkHardcodedSolution } from './complexity-heuristics.js';

describe('checkEmpiricalComplexity', () => {
  it('returns undefined with fewer than two distinct input sizes', () => {
    expect(checkEmpiricalComplexity('O(n)', [{ inputSize: 100, durationMs: 10 }])).toBeUndefined();
    expect(
      checkEmpiricalComplexity('O(n)', [
        { inputSize: 100, durationMs: 10 },
        { inputSize: 100, durationMs: 11 },
      ]),
    ).toBeUndefined();
  });

  it('does not flag O(n) growth that matches O(n) prediction', () => {
    const result = checkEmpiricalComplexity('O(n)', [
      { inputSize: 100, durationMs: 10 },
      { inputSize: 1000, durationMs: 100 },
    ]);
    expect(result?.worseThanExpected).toBe(false);
  });

  it('flags quadratic growth against an O(n) reference', () => {
    const result = checkEmpiricalComplexity('O(n)', [
      { inputSize: 100, durationMs: 10 },
      { inputSize: 1000, durationMs: 1000 },
    ]);
    expect(result?.worseThanExpected).toBe(true);
    expect(result?.note).toContain('less efficient');
  });

  it('does not flag a solution that is better than the reference complexity', () => {
    const result = checkEmpiricalComplexity('O(n^2)', [
      { inputSize: 100, durationMs: 10 },
      { inputSize: 1000, durationMs: 100 },
    ]);
    expect(result?.worseThanExpected).toBe(false);
  });

  it('treats O(1) as roughly constant regardless of input size', () => {
    const result = checkEmpiricalComplexity('O(1)', [
      { inputSize: 10, durationMs: 5 },
      { inputSize: 100_000, durationMs: 6 },
    ]);
    expect(result?.worseThanExpected).toBe(false);
  });

  it('treats O(log n) growth as expected for a binary-search-shaped solution', () => {
    const result = checkEmpiricalComplexity('O(log n)', [
      { inputSize: 100, durationMs: 10 },
      { inputSize: 100_000, durationMs: 20 },
    ]);
    expect(result?.worseThanExpected).toBe(false);
  });

  it('flags O(n) growth against an O(log n) reference', () => {
    const result = checkEmpiricalComplexity('O(log n)', [
      { inputSize: 100, durationMs: 10 },
      { inputSize: 100_000, durationMs: 10_000 },
    ]);
    expect(result?.worseThanExpected).toBe(true);
  });

  it('treats O(n log n) growth as expected for a sort-shaped solution', () => {
    const result = checkEmpiricalComplexity('O(n log n)', [
      { inputSize: 1000, durationMs: 10 },
      { inputSize: 1_000_000, durationMs: 20_000 },
    ]);
    expect(result?.worseThanExpected).toBe(false);
  });

  it('treats small O(2^n) growth as expected for an exponential-complexity question', () => {
    const result = checkEmpiricalComplexity('O(2^n)', [
      { inputSize: 10, durationMs: 1 },
      { inputSize: 20, durationMs: 1000 },
    ]);
    expect(result?.worseThanExpected).toBe(false);
  });

  it('uses the smallest and largest sizes when more than two samples are given', () => {
    const result = checkEmpiricalComplexity('O(n)', [
      { inputSize: 100, durationMs: 10 },
      { inputSize: 500, durationMs: 55 },
      { inputSize: 1000, durationMs: 20 },
    ]);
    expect(result?.note).toContain('size 100 to 1000');
  });

  it('deduplicates repeated input sizes, keeping the first duration seen', () => {
    const result = checkEmpiricalComplexity('O(n)', [
      { inputSize: 100, durationMs: 10 },
      { inputSize: 100, durationMs: 999 },
      { inputSize: 1000, durationMs: 100 },
    ]);
    expect(result?.worseThanExpected).toBe(false);
  });
});

describe('checkHardcodedSolution', () => {
  it('flags code that literally contains every expected output', () => {
    const code = 'console.log("42"); console.log("7");';
    expect(checkHardcodedSolution(code, ['42', '7'])).toBe(true);
  });

  it('does not flag code that computes the answer instead', () => {
    const code = 'console.log(a + b);';
    expect(checkHardcodedSolution(code, ['42', '7'])).toBe(false);
  });

  it('ignores trivial single-character expected outputs', () => {
    const code = 'function solve(n) { return n > 0 ? 1 : 0; }';
    expect(checkHardcodedSolution(code, ['1', '0'])).toBe(false);
  });

  it('returns false when there are no meaningful expected outputs', () => {
    expect(checkHardcodedSolution('anything', [])).toBe(false);
  });

  it('requires ALL meaningful outputs to be present, not just one', () => {
    const code = 'console.log("42");';
    expect(checkHardcodedSolution(code, ['42', 'unrelated-output'])).toBe(false);
  });
});
