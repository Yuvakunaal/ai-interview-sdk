/** A single sandboxed run request — deliberately dumb: no notion of "expected output" belongs here, only the evaluation engine compares results. */
export interface CodeExecutionRequest {
  language: string;
  code: string;
  stdin?: string;
  timeoutMs?: number;
  memoryLimitMb?: number;
}

export interface CodeExecutionResult {
  stdout: string;
  stderr: string;
  /** Null when the process was killed by a signal rather than exiting normally. */
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
  /** True when the sandbox believes the process was killed for exceeding its memory limit. Heuristic — see the provider's docs. */
  memoryExceeded: boolean;
  /** Present only for languages with a distinct compile step (absent implies no compile failure occurred, or the language has none). */
  compileError?: string;
}

/**
 * The pluggable sandbox boundary (§16: isolated deliberately so a sandbox
 * vulnerability can't compromise the rest of the SDK). Every execution
 * provider — Docker-based, a hosted service, or a developer's own —
 * implements this one method.
 */
export interface CodeExecutionProvider {
  readonly id: string;
  readonly supportedLanguages: string[];
  execute(request: CodeExecutionRequest): Promise<CodeExecutionResult>;
}

export interface CodingTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  /** Hidden test cases run and score normally, but their input/expected/actual output are omitted from anything shown to the candidate. */
  hidden?: boolean;
  /** Relative weight toward partial credit; defaults to 1. */
  weight?: number;
  /** "N" for this test case (e.g. array length) — enables the empirical complexity check when 3+ cases with distinct sizes are supplied. */
  inputSize?: number;
}

export type ReferenceComplexity = 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)' | 'O(n^2)' | 'O(2^n)';

export interface CodingQuestion {
  id: string;
  prompt: string;
  language: string;
  starterCode?: string;
  testCases: CodingTestCase[];
  timeLimitMs?: number;
  memoryLimitMb?: number;
  /** The complexity the developer expects a correct solution to have, for the empirical complexity check. */
  referenceComplexity?: ReferenceComplexity;
}

export type TestCaseFailureReason =
  'compile_error' | 'runtime_error' | 'timeout' | 'memory_exceeded' | 'wrong_output';

export interface TestCaseResult {
  testCaseId: string;
  hidden: boolean;
  passed: boolean;
  failureReason?: TestCaseFailureReason;
  /** Omitted for hidden test cases. */
  actualOutput?: string;
  durationMs: number;
}

export type CodingFlag =
  | 'compile_failure'
  | 'runtime_error'
  | 'timeout'
  | 'infinite_loop_suspected'
  | 'memory_exceeded'
  | 'partial_solution'
  | 'all_tests_passed'
  | 'hardcoded_solution_suspected'
  | 'complexity_worse_than_expected';

export interface CodingEvaluationResult {
  questionId: string;
  testCaseResults: TestCaseResult[];
  passedCount: number;
  totalCount: number;
  /** 0-100, weighted by each test case's `weight`. */
  totalScore: number;
  flags: CodingFlag[];
  complexityNote?: string;
}
