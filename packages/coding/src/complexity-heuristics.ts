import type { ReferenceComplexity } from './types.js';

export interface TimingSample {
  inputSize: number;
  durationMs: number;
}

export interface ComplexityCheckResult {
  worseThanExpected: boolean;
  note: string;
}

const COMPLEXITY_FUNCTIONS: Record<ReferenceComplexity, (n: number) => number> = {
  'O(1)': () => 1,
  'O(log n)': (n) => Math.log2(Math.max(n, 2)),
  'O(n)': (n) => n,
  'O(n log n)': (n) => n * Math.log2(Math.max(n, 2)),
  'O(n^2)': (n) => n * n,
  'O(2^n)': (n) => 2 ** n,
};

/** How much worse than the theoretical prediction actual runtime growth may be before it's flagged — timing noise (sandbox overhead, scheduling jitter) means this can't be tight. */
const GROWTH_TOLERANCE = 2.5;

/**
 * An empirical, not static, complexity check: rather than parsing the
 * candidate's code (a much harder and less reliable problem), this compares
 * how execution time actually grew between the smallest- and largest-input
 * passing test cases against what the developer's declared
 * `referenceComplexity` predicts. Requires at least two test cases with
 * distinct `inputSize` values — without that, there's no signal, and the
 * function returns `undefined` rather than guessing.
 *
 * This is a heuristic, not a proof: sandbox timing noise, small input sizes,
 * and constant-factor differences can all produce false positives or
 * negatives. Treat `worseThanExpected` as "worth a second look," not a
 * verdict.
 */
export function checkEmpiricalComplexity(
  referenceComplexity: ReferenceComplexity,
  samples: TimingSample[],
): ComplexityCheckResult | undefined {
  const bySize = new Map<number, number>();
  for (const sample of samples) {
    if (!bySize.has(sample.inputSize)) bySize.set(sample.inputSize, sample.durationMs);
  }
  if (bySize.size < 2) return undefined;

  const sorted = Array.from(bySize.entries()).sort((a, b) => a[0] - b[0]);
  const [smallSize, smallDuration] = sorted[0]!;
  const [largeSize, largeDuration] = sorted[sorted.length - 1]!;

  const fn = COMPLEXITY_FUNCTIONS[referenceComplexity];
  const predictedRatio = fn(largeSize) / fn(smallSize);
  const actualRatio = largeDuration / Math.max(smallDuration, 1);
  const worseThanExpected = actualRatio > predictedRatio * GROWTH_TOLERANCE;

  const note = worseThanExpected
    ? `Runtime grew ${actualRatio.toFixed(1)}x from input size ${smallSize} to ${largeSize}, but ` +
      `${referenceComplexity} predicts about ${predictedRatio.toFixed(1)}x — the solution may be less ` +
      'efficient than the expected complexity.'
    : `Runtime growth (${actualRatio.toFixed(1)}x from size ${smallSize} to ${largeSize}) is consistent ` +
      `with ${referenceComplexity} (expected about ${predictedRatio.toFixed(1)}x).`;

  return { worseThanExpected, note };
}

/** Ignore outputs too short/trivial to be a meaningful hardcoding signal (e.g. a single "0" or "1" that could appear in real logic for unrelated reasons). */
const MIN_MEANINGFUL_OUTPUT_LENGTH = 2;

/**
 * A cheap, honest heuristic for §8's "hardcoded solutions" edge case: flags
 * code that contains every expected test-case output as a literal string,
 * which is the fingerprint of `print("42")`-style hardcoding rather than
 * actual computation. Prone to both false positives (an output that
 * legitimately appears in real logic) and false negatives (hardcoding via
 * anything other than a literal, e.g. computed from the input index) —
 * treat it as a prompt to look closer, not a verdict.
 */
export function checkHardcodedSolution(code: string, expectedOutputs: string[]): boolean {
  const meaningful = expectedOutputs
    .map((output) => output.trim())
    .filter((output) => output.length >= MIN_MEANINGFUL_OUTPUT_LENGTH);
  if (meaningful.length === 0) return false;
  return meaningful.every((output) => code.includes(output));
}
