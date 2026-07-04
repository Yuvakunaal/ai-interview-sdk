import {
  EvaluationEngine,
  FollowUpEngine,
  type AIProviderAdapter,
  type FollowUpContext,
  type FollowUpEngineConfig,
} from '@interview-sdk/core';
import type { InterviewProcessor, ProcessAnswerInput, ProcessAnswerResult } from './types.js';

/**
 * Client Mode: evaluation and follow-up generation run directly in the
 * browser against a developer-supplied AIProviderAdapter. Prototyping only
 * — see InterviewWidget's production guard (§10).
 */
export class ClientModeProcessor implements InterviewProcessor {
  private readonly evaluationEngine = new EvaluationEngine();
  private readonly followUpEngine: FollowUpEngine;

  constructor(
    private readonly adapter: AIProviderAdapter,
    followUpConfig?: FollowUpEngineConfig,
  ) {
    this.followUpEngine = new FollowUpEngine(followUpConfig);
  }

  async processAnswer(input: ProcessAnswerInput): Promise<ProcessAnswerResult> {
    const evaluation = await this.evaluationEngine.evaluate({
      question: input.question,
      rubric: input.rubric,
      answer: input.answer,
      adapter: this.adapter,
      previousTurns: input.previousTurns,
    });

    const followUpContext: FollowUpContext = {
      question: input.question,
      answer: input.answer,
      evaluation,
      currentDepth: input.currentFollowUpDepth,
      askedFollowUps: input.askedFollowUps,
    };

    const decision = this.followUpEngine.decide(followUpContext);
    if (!decision.shouldGenerate) {
      return { evaluation };
    }

    const followUp = await this.followUpEngine.generate(followUpContext, this.adapter);
    return { evaluation, followUp };
  }
}
