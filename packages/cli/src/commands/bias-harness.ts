import {
  EvaluationEngine,
  defineRubric,
  type CandidateAnswer,
  type Question,
} from '@interview-sdk/core';
import { z } from 'zod';
import type { InterviewCliConfig } from '../config-loader.js';
import { CliConfigError } from '../errors.js';
import { loadStructuredFile } from '../structured-file.js';

export const biasSampleSchema = z.object({
  questionId: z.string().min(1),
  answerText: z.string(),
  expectedScoreRange: z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]),
  label: z.string().optional(),
});

export const biasSampleSetSchema = z.array(biasSampleSchema).min(1);

export type BiasSample = z.infer<typeof biasSampleSchema>;

export interface BiasHarnessOptions {
  /** Times to re-run each sample, to measure scoring variance. */
  runs?: number;
  /** Standard deviation above which a sample is flagged inconsistent. */
  varianceThreshold?: number;
}

export interface BiasSampleResult {
  questionId: string;
  label?: string;
  expectedScoreRange: [number, number];
  scores: number[];
  mean: number;
  stddev: number;
  withinRange: boolean;
  consistent: boolean;
}

export interface BiasHarnessReport {
  samples: BiasSampleResult[];
  passRate: number;
  warnings: string[];
}

const DEFAULT_RUNS = 3;
const DEFAULT_VARIANCE_THRESHOLD = 8;

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[], average: number): number {
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Loads and validates a labeled sample set (§11: "answer + expected score
 * range") from a JSON or YAML file.
 */
export async function loadBiasHarnessSamples(filePath: string): Promise<BiasSample[]> {
  const raw = await loadStructuredFile(filePath);
  const parsed = biasSampleSetSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new CliConfigError(`Invalid sample set in "${filePath}":\n- ${issues.join('\n- ')}`);
  }
  return parsed.data;
}

/**
 * The Bias & Consistency Testing Harness (§11): runs each labeled sample
 * against the rubric + AI provider multiple times and reports whether
 * scores land in the expected range and how much they vary run to run —
 * "how do I know this LLM grading is fair and consistent?"
 */
export async function runBiasHarness(
  config: Pick<InterviewCliConfig, 'questions' | 'rubric' | 'adapter'>,
  samples: BiasSample[],
  options: BiasHarnessOptions = {},
): Promise<BiasHarnessReport> {
  const runs = options.runs ?? DEFAULT_RUNS;
  const varianceThreshold = options.varianceThreshold ?? DEFAULT_VARIANCE_THRESHOLD;
  const rubric = defineRubric(config.rubric);
  const evaluationEngine = new EvaluationEngine();
  const questionsById = new Map<string, Question>(
    config.questions.map((question) => [question.id, question]),
  );

  const results: BiasSampleResult[] = [];
  const warnings: string[] = [];

  for (const sample of samples) {
    const question = questionsById.get(sample.questionId);
    if (!question) {
      throw new CliConfigError(
        `Sample "${sample.label ?? sample.questionId}" references unknown question id "${sample.questionId}".`,
      );
    }

    const answer: CandidateAnswer = {
      questionId: sample.questionId,
      text: sample.answerText,
      submittedAt: Date.now(),
    };

    const scores: number[] = [];
    for (let i = 0; i < runs; i++) {
      const evaluation = await evaluationEngine.evaluate({
        question,
        rubric,
        answer,
        adapter: config.adapter,
        previousTurns: [],
      });
      scores.push(evaluation.totalScore);
    }

    const average = mean(scores);
    const deviation = stddev(scores, average);
    const [min, max] = sample.expectedScoreRange;
    const withinRange = scores.every((score) => score >= min && score <= max);
    const consistent = deviation <= varianceThreshold;
    const name = sample.label ?? sample.questionId;

    if (!withinRange) {
      warnings.push(`"${name}" scored outside [${min}, ${max}]: got ${scores.join(', ')}.`);
    }
    if (!consistent) {
      warnings.push(
        `"${name}" is inconsistent across ${runs} runs (stddev ${deviation.toFixed(1)} > ${varianceThreshold}).`,
      );
    }

    results.push({
      questionId: sample.questionId,
      label: sample.label,
      expectedScoreRange: sample.expectedScoreRange,
      scores,
      mean: average,
      stddev: deviation,
      withinRange,
      consistent,
    });
  }

  const passCount = results.filter((result) => result.withinRange && result.consistent).length;
  return {
    samples: results,
    passRate: results.length > 0 ? passCount / results.length : 1,
    warnings,
  };
}
