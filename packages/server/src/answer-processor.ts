import {
  EvaluationEngine,
  FollowUpEngine,
  defineRubric,
  validateInterviewConfig,
  type AIProviderAdapter,
  type CandidateAnswer,
  type EvaluationResult,
  type EvaluationTurn,
  type FollowUpContext,
  type FollowUpEngineConfig,
  type FollowUpResult,
  type Question,
  type Rubric,
  type RubricDimensionInput,
} from '@interview-sdk/core';
import { UnknownQuestionIdError } from './errors.js';
import { sign } from './signing.js';

/**
 * Body shape this processor accepts. Deliberately structurally compatible
 * with @interview-sdk/react's `ProcessAnswerInput` (the Server Mode wire
 * contract designed in Phase 4) — `question` and `rubric`, if present, are
 * accepted but never trusted for scoring. Only `answer.questionId` is used,
 * to look up the canonical Question/Rubric configured on this processor.
 * A malicious or tampered client sending a stripped-down question (fewer
 * concepts) or a rubric that shifts weight onto a favorable dimension has no
 * effect on the resulting score.
 */
export interface ProcessAnswerRequestBody {
  question?: Question;
  rubric?: Rubric;
  answer: CandidateAnswer;
  previousTurns?: EvaluationTurn[];
  currentFollowUpDepth?: number;
  askedFollowUps?: string[];
}

export type SignedEvaluationResult = EvaluationResult & { signature: string };

export interface ProcessAnswerResponseBody {
  evaluation: EvaluationResult | SignedEvaluationResult;
  followUp?: FollowUpResult;
}

export interface ServerAnswerProcessorConfig {
  /** The canonical question bank — the only source of truth for what's being graded. */
  questions: Question[];
  /** The canonical rubric — the only source of truth for scoring weights. */
  rubric: RubricDimensionInput[];
  /** Runs server-side only; the client never sees this adapter or its API key. */
  adapter: AIProviderAdapter;
  followUpConfig?: FollowUpEngineConfig;
  /**
   * When set, every returned evaluation is HMAC-signed with this secret (see
   * `sign`/`verify` in `./signing.js`). Lets a developer who reconstructs a
   * final report from client-accumulated per-turn evaluations verify none of
   * them were edited in the browser before trusting the aggregate — without
   * this, the score is *computed* server-side but not *provably* untampered
   * once it reaches the client. Recommended for production.
   */
  signingSecret?: string;
}

/**
 * Server Mode's evaluation engine: the developer's own backend constructs
 * one of these (typically wrapped by `createInterviewAnswerHandler`) so AI
 * keys stay server-side and the question bank / rubric can't be swapped out
 * from the browser. Mirrors @interview-sdk/react's `ClientModeProcessor`
 * logic exactly, just running here instead of in the browser.
 */
export class ServerAnswerProcessor {
  private readonly questionsById: Map<string, Question>;
  private readonly rubric: Rubric;
  private readonly evaluationEngine = new EvaluationEngine();
  private readonly followUpEngine: FollowUpEngine;
  private readonly adapter: AIProviderAdapter;
  private readonly signingSecret: string | undefined;

  constructor(config: ServerAnswerProcessorConfig) {
    validateInterviewConfig({ questions: config.questions, rubric: config.rubric });

    this.questionsById = new Map(config.questions.map((question) => [question.id, question]));
    this.rubric = defineRubric(config.rubric);
    this.adapter = config.adapter;
    this.followUpEngine = new FollowUpEngine(config.followUpConfig);
    this.signingSecret = config.signingSecret;
  }

  async processAnswer(body: ProcessAnswerRequestBody): Promise<ProcessAnswerResponseBody> {
    const question = this.questionsById.get(body.answer.questionId);
    if (!question) {
      throw new UnknownQuestionIdError(
        `No configured question with id "${body.answer.questionId}". ` +
          'This processor only scores questions from its own configured question bank.',
      );
    }

    const evaluation = await this.evaluationEngine.evaluate({
      question,
      rubric: this.rubric,
      answer: body.answer,
      adapter: this.adapter,
      previousTurns: body.previousTurns ?? [],
    });

    const signedEvaluation: EvaluationResult | SignedEvaluationResult = this.signingSecret
      ? { ...evaluation, signature: sign(evaluation, this.signingSecret) }
      : evaluation;

    const followUpContext: FollowUpContext = {
      question,
      answer: body.answer,
      evaluation,
      currentDepth: body.currentFollowUpDepth ?? 0,
      askedFollowUps: body.askedFollowUps ?? [],
    };

    const decision = this.followUpEngine.decide(followUpContext);
    if (!decision.shouldGenerate) {
      return { evaluation: signedEvaluation };
    }

    const followUp = await this.followUpEngine.generate(followUpContext, this.adapter);
    return { evaluation: signedEvaluation, followUp };
  }
}
