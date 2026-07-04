export type Language = string;

export interface Question {
  id: string;
  prompt: string;
  concepts?: string[];
  answerKey?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  maxFollowUps?: number;
  timeLimitMs?: number;
}

export interface RubricDimensionInput {
  id: string;
  label: string;
  weight: number;
  description?: string;
}

export interface RubricDimension extends RubricDimensionInput {
  normalizedWeight: number;
}

export interface Rubric {
  dimensions: RubricDimension[];
}

export interface CandidateAnswer {
  questionId: string;
  text: string;
  submittedAt: number;
  isSkipped?: boolean;
  isSilence?: boolean;
}

export type EvaluationFlag =
  | 'no_answer'
  | 'skipped'
  | 'very_short_answer'
  | 'very_long_answer'
  | 'off_topic'
  | 'i_dont_know'
  | 'avoidance'
  | 'hint_request'
  | 'candidate_question'
  | 'contradiction'
  | 'partial_concept_coverage';

export interface ConceptCoverageResult {
  concept: string;
  covered: boolean;
  partial?: boolean;
}

export interface EvaluationResult {
  questionId: string;
  dimensionScores: Record<string, number>;
  totalScore: number;
  conceptCoverage: ConceptCoverageResult[];
  contradictions: string[];
  flags: EvaluationFlag[];
  matchesAnswerKey?: boolean;
  rationale?: string;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
}

export interface VoiceConfig {
  provider?: string;
  language?: Language;
}

export interface InterviewConfig {
  questions: Question[];
  rubric: RubricDimensionInput[];
  aiProvider?: string;
  voice?: VoiceConfig;
  webhook?: WebhookConfig;
  theme?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'adaptive';
  language?: Language;
  maxFollowUpDepth?: number;
  sessionTimeoutMs?: number;
}
