export type Language = string;

export interface Question {
  id: string;
  prompt: string;
  concepts?: string[];
  answerKey?: string;
  /**
   * Descriptive metadata only — not read by any engine in this package.
   * The full `Question` is embedded in each `TranscriptEntry`/`InterviewReport`
   * entry, so your own reporting/analytics code can group or filter by this
   * (e.g. "score breakdown by difficulty") without the SDK needing to
   * interpret it itself.
   */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Overrides the session-wide `maxFollowUpDepth` for this question only — see `FollowUpEngine`. */
  maxFollowUps?: number;
  /**
   * The subset of your rubric's dimension ids this specific question
   * actually assesses. Omit to have every question assess every rubric
   * dimension (the previous, still-fully-supported default) — set this
   * when your rubric has a dimension that doesn't apply to every question
   * (e.g. a "Systems thinking" dimension has nothing to grade on a plain
   * syntax-recall question like "What does a WHERE clause do?"). A
   * dimension no question declares is never scored, never dragged to 0,
   * and never shown in the report at all — rather than the previous
   * behavior of silently scoring it 0 on every question that didn't
   * address it, which both understated the candidate's real total score
   * and read as a false, demoralizing failure on something they were never
   * actually asked about.
   */
  dimensions?: string[];
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
  /**
   * Only ever has an entry for a dimension this question actually assessed
   * (all of them, unless `Question.dimensions` narrowed it) — a dimension
   * outside that set is simply absent here, not present at 0.
   */
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

/**
 * A validated schema for describing an interview setup — e.g. what a config
 * file, CLI scaffold, or dashboard UI reads/writes. `validateInterviewConfig`
 * checks its shape (URLs, weights, duplicate ids, language tags, etc.), but
 * this object is not itself wired into any SDK runtime class. `aiProvider`
 * and `webhook` in particular are metadata for your own glue code to act on
 * (e.g. `if (config.aiProvider === 'openai') new OpenAIAdapter(...)`, or
 * construct your own `WebhookDispatcher` from `config.webhook` at the point
 * in your app where a webhook-worthy event actually happens) — the adapter
 * and dispatcher are always constructed and applied explicitly by you
 * (`<InterviewWidget adapter={...}>`, `new WebhookDispatcher(...)`), never
 * inferred from this config automatically.
 */
export interface InterviewConfig {
  questions: Question[];
  rubric: RubricDimensionInput[];
  aiProvider?: string;
  voice?: VoiceConfig;
  webhook?: WebhookConfig;
  difficulty?: 'easy' | 'medium' | 'hard' | 'adaptive';
  language?: Language;
  maxFollowUpDepth?: number;
  sessionTimeoutMs?: number;
}
