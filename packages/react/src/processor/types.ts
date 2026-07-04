import type {
  CandidateAnswer,
  EvaluationResult,
  EvaluationTurn,
  FollowUpDifficulty,
  Question,
  Rubric,
} from '@interview-sdk/core';

export interface ProcessAnswerInput {
  question: Question;
  rubric: Rubric;
  answer: CandidateAnswer;
  previousTurns: EvaluationTurn[];
  currentFollowUpDepth: number;
  askedFollowUps: string[];
}

export interface ProcessAnswerFollowUp {
  prompt: string;
  difficulty?: FollowUpDifficulty;
  targetsMissedConcepts: string[];
}

export interface ProcessAnswerResult {
  evaluation: EvaluationResult;
  followUp?: ProcessAnswerFollowUp;
}

/**
 * Abstracts over Client Mode (evaluate/follow-up run in the browser via an
 * injected AIProviderAdapter) and Server Mode (a single round trip to the
 * developer's own backend, which does the same work using
 * @interview-sdk/server). InterviewWidget/useInterview only ever talk to
 * this interface, never to the mode-specific detail.
 */
export interface InterviewProcessor {
  processAnswer(input: ProcessAnswerInput): Promise<ProcessAnswerResult>;
}
