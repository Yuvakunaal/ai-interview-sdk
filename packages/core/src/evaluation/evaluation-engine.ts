import { parseAdapterJson } from '../adapter/parse-json.js';
import type { AIProviderAdapter } from '../adapter/types.js';
import { AnswerTooLongError, TooManyPreviousTurnsError } from '../errors.js';
import { scopeRubricToQuestion, scoreRubric } from '../rubric/rubric.js';
import type {
  CandidateAnswer,
  EvaluationFlag,
  EvaluationResult,
  Question,
  Rubric,
} from '../types.js';
import { isExplicitDontKnowAnswer } from './dont-know.js';
import { buildEvaluationRequest, type EvaluationTurn } from './prompt.js';
import { evaluationResponseSchema } from './schema.js';

const VERY_SHORT_ANSWER_THRESHOLD = 15;
const VERY_LONG_ANSWER_THRESHOLD = 4000;
// Well beyond any real spoken/typed/pasted-code interview answer — this
// guards against a pathological payload reaching a paid provider API, not
// against genuinely long-but-legitimate answers (those still get scored,
// just flagged via VERY_LONG_ANSWER_THRESHOLD above).
const MAX_ANSWER_TEXT_LENGTH = 20_000;
// Generous for any real interview's question count — this guards against a
// client attaching a fabricated multi-turn history to inflate provider costs.
const MAX_PREVIOUS_TURNS = 50;

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
    // Every scoring path below (deterministic short-circuits and the real
    // AI call alike) only ever sees the dimensions this question actually
    // declares — see `Question.dimensions` and `scopeRubricToQuestion`.
    const scopedRubric = scopeRubricToQuestion(rubric, question.dimensions);

    // Deterministic short-circuits: no AI call needed (or possible) for these.
    if (answer.isSkipped) {
      return this.zeroResult(question, scopedRubric, ['skipped']);
    }
    if (answer.isSilence || answer.text.trim() === '') {
      return this.zeroResult(question, scopedRubric, ['no_answer']);
    }
    // A real provider call is still made for anything short of a bare
    // admission — an AI's own leniency isn't trusted here specifically
    // because it was observed handing out a 75-90/100 partial score for
    // exactly "I don't know" on a follow-up in practice. This can't
    // depend on any given model consistently scoring that at 0.
    if (isExplicitDontKnowAnswer(answer.text)) {
      return this.zeroResult(question, scopedRubric, ['i_dont_know']);
    }
    if (answer.text.length > MAX_ANSWER_TEXT_LENGTH) {
      throw new AnswerTooLongError(MAX_ANSWER_TEXT_LENGTH, answer.text.length);
    }

    const previousTurns = options.previousTurns ?? [];
    if (previousTurns.length > MAX_PREVIOUS_TURNS) {
      throw new TooManyPreviousTurnsError(MAX_PREVIOUS_TURNS, previousTurns.length);
    }
    for (const turn of previousTurns) {
      if (turn.answer.text.length > MAX_ANSWER_TEXT_LENGTH) {
        throw new AnswerTooLongError(MAX_ANSWER_TEXT_LENGTH, turn.answer.text.length);
      }
    }

    const preFlags: EvaluationFlag[] = [];
    const trimmedLength = answer.text.trim().length;
    if (trimmedLength < VERY_SHORT_ANSWER_THRESHOLD) preFlags.push('very_short_answer');
    if (trimmedLength > VERY_LONG_ANSWER_THRESHOLD) preFlags.push('very_long_answer');

    const request = buildEvaluationRequest({
      question,
      rubric: scopedRubric,
      answer,
      previousTurns: options.previousTurns,
    });

    const response = await options.adapter.complete(request);
    const parsed = parseAdapterJson(response.text, evaluationResponseSchema);

    const { total, breakdown } = scoreRubric(scopedRubric, parsed.dimensionScores);
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
