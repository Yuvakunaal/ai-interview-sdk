import { parseAdapterJson } from '../adapter/parse-json.js';
import type { AIProviderAdapter } from '../adapter/types.js';
import { scoreRubric } from '../rubric/rubric.js';
import type {
  CandidateAnswer,
  EvaluationFlag,
  EvaluationResult,
  Question,
  Rubric,
} from '../types.js';
import { buildEvaluationRequest, type EvaluationTurn } from './prompt.js';
import { evaluationResponseSchema } from './schema.js';

const VERY_SHORT_ANSWER_THRESHOLD = 15;
const VERY_LONG_ANSWER_THRESHOLD = 4000;

export interface EvaluateOptions {
  question: Question;
  rubric: Rubric;
  answer: CandidateAnswer;
  adapter: AIProviderAdapter;
  previousTurns?: EvaluationTurn[];
}

export class EvaluationEngine {
  async evaluate(options: EvaluateOptions): Promise<EvaluationResult> {
    const { question, rubric, answer } = options;

    // Deterministic short-circuits: no AI call needed (or possible) for these.
    if (answer.isSkipped) {
      return this.zeroResult(question, rubric, ['skipped']);
    }
    if (answer.isSilence || answer.text.trim() === '') {
      return this.zeroResult(question, rubric, ['no_answer']);
    }

    const preFlags: EvaluationFlag[] = [];
    const trimmedLength = answer.text.trim().length;
    if (trimmedLength < VERY_SHORT_ANSWER_THRESHOLD) preFlags.push('very_short_answer');
    if (trimmedLength > VERY_LONG_ANSWER_THRESHOLD) preFlags.push('very_long_answer');

    const request = buildEvaluationRequest({
      question,
      rubric,
      answer,
      previousTurns: options.previousTurns,
    });

    const response = await options.adapter.complete(request);
    const parsed = parseAdapterJson(response.text, evaluationResponseSchema);

    const { total, breakdown } = scoreRubric(rubric, parsed.dimensionScores);
    const dimensionScores = Object.fromEntries(
      Object.entries(breakdown).map(([id, value]) => [id, value.score]),
    );

    const flags = Array.from(new Set<EvaluationFlag>([...preFlags, ...parsed.flags]));

    return {
      questionId: question.id,
      dimensionScores,
      totalScore: total,
      conceptCoverage: parsed.conceptCoverage,
      contradictions: parsed.contradictions,
      flags,
      matchesAnswerKey: parsed.matchesAnswerKey,
      rationale: parsed.rationale,
    };
  }

  private zeroResult(
    question: Question,
    rubric: Rubric,
    flags: EvaluationFlag[],
  ): EvaluationResult {
    const dimensionScores = Object.fromEntries(rubric.dimensions.map((d) => [d.id, 0]));
    return {
      questionId: question.id,
      dimensionScores,
      totalScore: 0,
      conceptCoverage: (question.concepts ?? []).map((concept) => ({ concept, covered: false })),
      contradictions: [],
      flags,
    };
  }
}
