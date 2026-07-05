import { describe, expect, it, vi } from 'vitest';
import { CodingEvaluationEngine } from './coding-evaluation-engine.js';
import type { CodeExecutionProvider, CodeExecutionResult, CodingQuestion } from './types.js';

function execResult(overrides: Partial<CodeExecutionResult> = {}): CodeExecutionResult {
  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
    timedOut: false,
    durationMs: 10,
    memoryExceeded: false,
    ...overrides,
  };
}

function queueProvider(results: CodeExecutionResult[]): CodeExecutionProvider {
  let call = 0;
  return {
    id: 'fake',
    supportedLanguages: ['javascript'],
    execute: vi.fn(async () => {
      const result = results[Math.min(call, results.length - 1)]!;
      call += 1;
      return result;
    }),
  };
}

function baseQuestion(overrides: Partial<CodingQuestion> = {}): CodingQuestion {
  return {
    id: 'q1',
    prompt: 'Sum two numbers.',
    language: 'javascript',
    testCases: [
      { id: 't1', input: '1 2', expectedOutput: '3' },
      { id: 't2', input: '5 5', expectedOutput: '10' },
    ],
    ...overrides,
  };
}

describe('CodingEvaluationEngine', () => {
  it('scores 100 and flags all_tests_passed when every test case passes', async () => {
    const provider = queueProvider([execResult({ stdout: '3' }), execResult({ stdout: '10' })]);
    const engine = new CodingEvaluationEngine(provider);

    const result = await engine.evaluate(baseQuestion(), { code: 'x', language: 'javascript' });

    expect(result.totalScore).toBe(100);
    expect(result.passedCount).toBe(2);
    expect(result.flags).toContain('all_tests_passed');
    expect(result.flags).not.toContain('partial_solution');
  });

  it('computes weighted partial credit when only some test cases pass', async () => {
    const provider = queueProvider([execResult({ stdout: '3' }), execResult({ stdout: 'wrong' })]);
    const question = baseQuestion({
      testCases: [
        { id: 't1', input: '1 2', expectedOutput: '3', weight: 3 },
        { id: 't2', input: '5 5', expectedOutput: '10', weight: 1 },
      ],
    });
    const engine = new CodingEvaluationEngine(provider);

    const result = await engine.evaluate(question, { code: 'x', language: 'javascript' });

    expect(result.totalScore).toBe(75); // 3 of 4 weight units earned
    expect(result.flags).toContain('partial_solution');
    expect(result.testCaseResults[1]?.failureReason).toBe('wrong_output');
  });

  it('omits actualOutput for hidden test cases but keeps it for visible ones', async () => {
    const provider = queueProvider([execResult({ stdout: '3' }), execResult({ stdout: '10' })]);
    const question = baseQuestion({
      testCases: [
        { id: 't1', input: '1 2', expectedOutput: '3' },
        { id: 't2', input: '5 5', expectedOutput: '10', hidden: true },
      ],
    });
    const engine = new CodingEvaluationEngine(provider);

    const result = await engine.evaluate(question, { code: 'x', language: 'javascript' });

    expect(result.testCaseResults[0]?.actualOutput).toBe('3');
    expect(result.testCaseResults[1]?.hidden).toBe(true);
    expect(result.testCaseResults[1]?.actualOutput).toBeUndefined();
  });

  it('flags a compile failure and treats it as a failed test case', async () => {
    const provider = queueProvider([
      execResult({ compileError: 'SyntaxError: unexpected token', exitCode: 1, stdout: '' }),
    ]);
    const question = baseQuestion({
      testCases: [{ id: 't1', input: '', expectedOutput: 'anything' }],
    });
    const engine = new CodingEvaluationEngine(provider);

    const result = await engine.evaluate(question, { code: 'x', language: 'javascript' });

    expect(result.testCaseResults[0]?.failureReason).toBe('compile_error');
    expect(result.flags).toContain('compile_failure');
  });

  it('flags runtime_error for a non-zero exit with no compile error', async () => {
    const provider = queueProvider([execResult({ exitCode: 1, stderr: 'boom' })]);
    const question = baseQuestion({ testCases: [{ id: 't1', input: '', expectedOutput: 'x' }] });
    const engine = new CodingEvaluationEngine(provider);

    const result = await engine.evaluate(question, { code: 'x', language: 'javascript' });
    expect(result.testCaseResults[0]?.failureReason).toBe('runtime_error');
    expect(result.flags).toContain('runtime_error');
  });

  it('flags infinite_loop_suspected only when every test case times out', async () => {
    const allTimeOut = queueProvider([
      execResult({ timedOut: true }),
      execResult({ timedOut: true }),
    ]);
    const engineAll = new CodingEvaluationEngine(allTimeOut);
    const resultAll = await engineAll.evaluate(baseQuestion(), {
      code: 'x',
      language: 'javascript',
    });
    expect(resultAll.flags).toContain('infinite_loop_suspected');

    const someTimeOut = queueProvider([
      execResult({ stdout: '3' }),
      execResult({ timedOut: true }),
    ]);
    const engineSome = new CodingEvaluationEngine(someTimeOut);
    const resultSome = await engineSome.evaluate(baseQuestion(), {
      code: 'x',
      language: 'javascript',
    });
    expect(resultSome.flags).toContain('timeout');
    expect(resultSome.flags).not.toContain('infinite_loop_suspected');
  });

  it('flags memory_exceeded when the sandbox reports it', async () => {
    const provider = queueProvider([execResult({ memoryExceeded: true, exitCode: 137 })]);
    const question = baseQuestion({ testCases: [{ id: 't1', input: '', expectedOutput: 'x' }] });
    const engine = new CodingEvaluationEngine(provider);

    const result = await engine.evaluate(question, { code: 'x', language: 'javascript' });
    expect(result.flags).toContain('memory_exceeded');
  });

  it('flags hardcoded_solution_suspected when a fully-passing submission literally contains every expected output', async () => {
    const provider = queueProvider([execResult({ stdout: '3' }), execResult({ stdout: '10' })]);
    const engine = new CodingEvaluationEngine(provider);

    const result = await engine.evaluate(baseQuestion(), {
      code: 'console.log("3"); console.log("10");',
      language: 'javascript',
    });

    expect(result.flags).toContain('hardcoded_solution_suspected');
  });

  it('does not flag hardcoded_solution_suspected for a submission that computes the answer', async () => {
    const provider = queueProvider([execResult({ stdout: '3' }), execResult({ stdout: '10' })]);
    const engine = new CodingEvaluationEngine(provider);

    const result = await engine.evaluate(baseQuestion(), {
      code: 'console.log(a + b);',
      language: 'javascript',
    });

    expect(result.flags).not.toContain('hardcoded_solution_suspected');
  });

  it('flags complexity_worse_than_expected when timing grows faster than the declared complexity', async () => {
    const provider = queueProvider([
      execResult({ stdout: 'ok', durationMs: 10 }),
      execResult({ stdout: 'ok', durationMs: 1000 }),
    ]);
    const question = baseQuestion({
      referenceComplexity: 'O(n)',
      testCases: [
        { id: 't1', input: '', expectedOutput: 'ok', inputSize: 100 },
        { id: 't2', input: '', expectedOutput: 'ok', inputSize: 1000 },
      ],
    });
    const engine = new CodingEvaluationEngine(provider);

    const result = await engine.evaluate(question, { code: 'x', language: 'javascript' });

    expect(result.flags).toContain('complexity_worse_than_expected');
    expect(result.complexityNote).toBeDefined();
  });

  it('sets a complexity note without the warning flag when growth matches the declared complexity', async () => {
    const provider = queueProvider([
      execResult({ stdout: 'ok', durationMs: 10 }),
      execResult({ stdout: 'ok', durationMs: 100 }),
    ]);
    const question = baseQuestion({
      referenceComplexity: 'O(n)',
      testCases: [
        { id: 't1', input: '', expectedOutput: 'ok', inputSize: 100 },
        { id: 't2', input: '', expectedOutput: 'ok', inputSize: 1000 },
      ],
    });
    const engine = new CodingEvaluationEngine(provider);

    const result = await engine.evaluate(question, { code: 'x', language: 'javascript' });

    expect(result.complexityNote).toBeDefined();
    expect(result.flags).not.toContain('complexity_worse_than_expected');
  });

  it('leaves complexityNote unset when referenceComplexity is set but fewer than two input sizes are declared', async () => {
    const provider = queueProvider([execResult({ stdout: 'ok' }), execResult({ stdout: 'ok' })]);
    const question = baseQuestion({
      referenceComplexity: 'O(n)',
      testCases: [
        { id: 't1', input: '', expectedOutput: 'ok' },
        { id: 't2', input: '', expectedOutput: 'ok' },
      ],
    });
    const engine = new CodingEvaluationEngine(provider);

    const result = await engine.evaluate(question, { code: 'x', language: 'javascript' });

    expect(result.complexityNote).toBeUndefined();
    expect(result.flags).not.toContain('complexity_worse_than_expected');
  });

  it('does not compute a complexity note when referenceComplexity is not set', async () => {
    const provider = queueProvider([execResult({ stdout: '3' }), execResult({ stdout: '10' })]);
    const engine = new CodingEvaluationEngine(provider);

    const result = await engine.evaluate(baseQuestion(), { code: 'x', language: 'javascript' });
    expect(result.complexityNote).toBeUndefined();
  });

  it('passes the question time and memory limits through to the provider', async () => {
    const provider = queueProvider([execResult({ stdout: '3' }), execResult({ stdout: '10' })]);
    const question = baseQuestion({ timeLimitMs: 2000, memoryLimitMb: 128 });
    const engine = new CodingEvaluationEngine(provider);

    await engine.evaluate(question, { code: 'x', language: 'javascript' });

    expect(provider.execute).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 2000, memoryLimitMb: 128 }),
    );
  });
});
