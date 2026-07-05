import {
  checkEmpiricalComplexity,
  checkHardcodedSolution,
  type TimingSample,
} from './complexity-heuristics.js';
import type {
  CodeExecutionProvider,
  CodeExecutionResult,
  CodingEvaluationResult,
  CodingFlag,
  CodingQuestion,
  CodingTestCase,
  TestCaseFailureReason,
  TestCaseResult,
} from './types.js';

export interface CodingSubmission {
  code: string;
  language: string;
}

function normalizeOutput(value: string): string {
  return value.trim().replace(/\r\n/g, '\n');
}

function classifyFailure(
  result: CodeExecutionResult,
  expectedOutput: string,
): TestCaseFailureReason | undefined {
  if (result.compileError !== undefined) return 'compile_error';
  if (result.timedOut) return 'timeout';
  if (result.memoryExceeded) return 'memory_exceeded';
  if (result.exitCode !== 0) return 'runtime_error';
  if (normalizeOutput(result.stdout) !== normalizeOutput(expectedOutput)) return 'wrong_output';
  return undefined;
}

function computeWeightedScore(testCases: CodingTestCase[], results: TestCaseResult[]): number {
  let totalWeight = 0;
  let earnedWeight = 0;
  for (let i = 0; i < testCases.length; i++) {
    const weight = testCases[i]!.weight ?? 1;
    totalWeight += weight;
    if (results[i]!.passed) earnedWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round((earnedWeight / totalWeight) * 10000) / 100;
}

/**
 * Orchestrates Coding Interview Mode's evaluation: runs a submission against
 * every test case (visible and hidden) through a `CodeExecutionProvider`,
 * classifies each failure (compile/runtime/timeout/memory/wrong-output),
 * computes weighted partial credit, and folds in the complexity and
 * hardcoded-solution heuristics. Deliberately provider-agnostic — swap
 * `DockerCodeExecutionProvider` for `PistonCodeExecutionProvider` (or a
 * custom one) without touching this class.
 */
export class CodingEvaluationEngine {
  constructor(private readonly provider: CodeExecutionProvider) {}

  async evaluate(
    question: CodingQuestion,
    submission: CodingSubmission,
  ): Promise<CodingEvaluationResult> {
    const testCaseResults: TestCaseResult[] = [];
    const timingSamples: TimingSample[] = [];

    for (const testCase of question.testCases) {
      const executionResult = await this.provider.execute({
        language: submission.language,
        code: submission.code,
        stdin: testCase.input,
        timeoutMs: question.timeLimitMs,
        memoryLimitMb: question.memoryLimitMb,
      });

      const failureReason = classifyFailure(executionResult, testCase.expectedOutput);
      const passed = !failureReason;

      testCaseResults.push({
        testCaseId: testCase.id,
        hidden: testCase.hidden ?? false,
        passed,
        failureReason,
        actualOutput: testCase.hidden ? undefined : executionResult.stdout,
        durationMs: executionResult.durationMs,
      });

      if (passed && testCase.inputSize !== undefined) {
        timingSamples.push({
          inputSize: testCase.inputSize,
          durationMs: executionResult.durationMs,
        });
      }
    }

    const passedCount = testCaseResults.filter((result) => result.passed).length;
    const totalCount = testCaseResults.length;
    const totalScore = computeWeightedScore(question.testCases, testCaseResults);

    const flags = new Set<CodingFlag>();
    for (const result of testCaseResults) {
      if (result.failureReason === 'compile_error') flags.add('compile_failure');
      if (result.failureReason === 'runtime_error') flags.add('runtime_error');
      if (result.failureReason === 'timeout') flags.add('timeout');
      if (result.failureReason === 'memory_exceeded') flags.add('memory_exceeded');
    }
    if (totalCount > 0 && testCaseResults.every((result) => result.failureReason === 'timeout')) {
      flags.add('infinite_loop_suspected');
    }
    if (totalCount > 0 && passedCount === totalCount) {
      flags.add('all_tests_passed');
    } else if (passedCount > 0) {
      flags.add('partial_solution');
    }

    if (totalCount > 0 && passedCount === totalCount) {
      const expectedOutputs = question.testCases.map((testCase) => testCase.expectedOutput);
      if (checkHardcodedSolution(submission.code, expectedOutputs)) {
        flags.add('hardcoded_solution_suspected');
      }
    }

    let complexityNote: string | undefined;
    if (question.referenceComplexity && totalCount > 0 && passedCount === totalCount) {
      const complexityResult = checkEmpiricalComplexity(
        question.referenceComplexity,
        timingSamples,
      );
      if (complexityResult) {
        complexityNote = complexityResult.note;
        if (complexityResult.worseThanExpected) flags.add('complexity_worse_than_expected');
      }
    }

    return {
      questionId: question.id,
      testCaseResults,
      passedCount,
      totalCount,
      totalScore,
      flags: Array.from(flags),
      complexityNote,
    };
  }
}
