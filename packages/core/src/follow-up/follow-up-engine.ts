import { parseAdapterJson } from '../adapter/parse-json.js';
import type { AIProviderAdapter } from '../adapter/types.js';
import { FollowUpDepthExceededError, InterviewSdkError } from '../errors.js';
import type { CandidateAnswer, EvaluationResult, Question } from '../types.js';
import { jaccardSimilarity } from '../utils/similarity.js';
import { buildFollowUpRequest } from './prompt.js';
import { followUpResponseSchema } from './schema.js';

const REPEAT_SIMILARITY_THRESHOLD = 0.8;
const MAX_GENERATION_ATTEMPTS = 3;
const FULL_COVERAGE_SCORE_THRESHOLD = 90;

export type FollowUpDifficulty = 'easier' | 'same' | 'harder';

/** Maps a missed concept id to a canned follow-up prompt, tried before an AI call. */
export type FollowUpBranchMap = Record<string, string>;

export interface FollowUpEngineConfig {
  maxDepth?: number;
  branches?: FollowUpBranchMap;
}

export interface FollowUpContext {
  question: Question;
  answer: CandidateAnswer;
  evaluation: EvaluationResult;
  currentDepth: number;
  askedFollowUps: string[];
  timedOut?: boolean;
}

export interface FollowUpDecision {
  shouldGenerate: boolean;
  reason: string;
}

export interface FollowUpResult {
  prompt: string;
  difficulty?: FollowUpDifficulty;
  targetsMissedConcepts: string[];
  source: 'branch' | 'ai';
}

export class FollowUpEngine {
  private readonly maxDepth: number;
  private readonly branches: FollowUpBranchMap;

  constructor(config: FollowUpEngineConfig = {}) {
    this.maxDepth = config.maxDepth ?? 2;
    this.branches = config.branches ?? {};
  }

  decide(context: FollowUpContext): FollowUpDecision {
    if (context.timedOut) {
      return { shouldGenerate: false, reason: 'timed_out' };
    }
    const maxDepth = context.question.maxFollowUps ?? this.maxDepth;
    if (context.currentDepth >= maxDepth) {
      return { shouldGenerate: false, reason: 'max_depth_reached' };
    }
    if (
      context.evaluation.flags.includes('no_answer') ||
      context.evaluation.flags.includes('skipped') ||
      context.evaluation.flags.includes('i_dont_know')
    ) {
      // An explicit "I don't know" is a real, present response — unlike
      // no_answer/skipped it isn't silence — but probing the same missed
      // concept again after the candidate already said they don't know it
      // isn't a follow-up worth asking; better to move on to the next
      // question than repeat the same dead end.
      return { shouldGenerate: false, reason: 'no_answer_to_follow_up_on' };
    }

    const missedConcepts = context.evaluation.conceptCoverage.filter((c) => !c.covered);
    if (
      missedConcepts.length === 0 &&
      context.evaluation.totalScore >= FULL_COVERAGE_SCORE_THRESHOLD
    ) {
      return { shouldGenerate: false, reason: 'answer_fully_covers_concepts' };
    }

    return { shouldGenerate: true, reason: 'concepts_missing_or_room_to_probe' };
  }

  async generate(context: FollowUpContext, adapter: AIProviderAdapter): Promise<FollowUpResult> {
    const decision = this.decide(context);
    if (!decision.shouldGenerate) {
      throw new FollowUpDepthExceededError(`Cannot generate a follow-up: ${decision.reason}`);
    }

    const missedConcepts = context.evaluation.conceptCoverage
      .filter((c) => !c.covered)
      .map((c) => c.concept);

    for (const concept of missedConcepts) {
      const branchPrompt = this.branches[concept];
      if (branchPrompt && !this.isRepeat(branchPrompt, context.askedFollowUps)) {
        return { prompt: branchPrompt, targetsMissedConcepts: [concept], source: 'branch' };
      }
    }

    const desiredDifficulty = this.desiredDifficulty(context.evaluation.totalScore);

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      const request = buildFollowUpRequest({
        question: context.question,
        answer: context.answer,
        evaluation: context.evaluation,
        desiredDifficulty,
        missedConcepts,
      });
      const response = await adapter.complete(request);
      const parsed = parseAdapterJson(response.text, followUpResponseSchema);

      if (!this.isRepeat(parsed.prompt, context.askedFollowUps)) {
        return { ...parsed, source: 'ai' };
      }
    }

    throw new InterviewSdkError(
      `Follow-up engine could not generate a non-repeating follow-up after ${MAX_GENERATION_ATTEMPTS} attempts.`,
    );
  }

  private desiredDifficulty(totalScore: number): FollowUpDifficulty {
    if (totalScore >= 75) return 'harder';
    if (totalScore <= 40) return 'easier';
    return 'same';
  }

  private isRepeat(candidate: string, asked: string[]): boolean {
    return asked.some(
      (previous) => jaccardSimilarity(previous, candidate) > REPEAT_SIMILARITY_THRESHOLD,
    );
  }
}
