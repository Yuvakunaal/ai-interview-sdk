import { InterviewEventEmitter } from '../events.js';
import { ConfigValidationError, InterviewSdkError, SessionExpiredError } from '../errors.js';
import type { CandidateAnswer, Question } from '../types.js';

export type SessionStatus = 'not_started' | 'in_progress' | 'paused' | 'completed' | 'expired';

export interface SessionState {
  sessionId: string;
  status: SessionStatus;
  currentQuestionIndex: number;
  followUpDepthForCurrentQuestion: number;
  answers: CandidateAnswer[];
  followUpPromptsAsked: Record<string, string[]>;
  answeredTurnKeys: string[];
  startedAt?: number;
  updatedAt: number;
  completedAt?: number;
}

export interface FlowEngineConfig {
  questions: Question[];
  maxFollowUpDepth?: number;
  sessionTimeoutMs?: number;
  sessionId?: string;
}

export interface SubmitAnswerInput {
  text: string;
  isSkipped?: boolean;
  isSilence?: boolean;
}

function validateQuestions(questions: Question[]): void {
  const issues: string[] = [];
  if (!questions || questions.length === 0) {
    issues.push('At least one question is required.');
  }
  const seenIds = new Set<string>();
  for (const question of questions ?? []) {
    if (typeof question.id !== 'string' || question.id.trim() === '') {
      issues.push('A question is missing an id.');
    } else if (seenIds.has(question.id)) {
      issues.push(`Duplicate question id: "${question.id}".`);
    } else {
      seenIds.add(question.id);
    }
  }
  if (issues.length > 0) throw new ConfigValidationError(issues);
}

function validateSessionTimeout(sessionTimeoutMs: number | undefined): void {
  if (sessionTimeoutMs === undefined) return;
  if (!Number.isFinite(sessionTimeoutMs) || sessionTimeoutMs <= 0) {
    throw new ConfigValidationError([
      `Invalid sessionTimeoutMs: "${sessionTimeoutMs}". Must be a positive number.`,
    ]);
  }
}

export class InterviewFlowEngine {
  readonly events = new InterviewEventEmitter();
  private readonly questions: Question[];
  private readonly maxFollowUpDepth: number;
  private readonly sessionTimeoutMs?: number;
  private state: SessionState;

  constructor(config: FlowEngineConfig) {
    validateQuestions(config.questions);
    validateSessionTimeout(config.sessionTimeoutMs);
    this.questions = config.questions;
    this.maxFollowUpDepth = config.maxFollowUpDepth ?? 2;
    this.sessionTimeoutMs = config.sessionTimeoutMs;
    this.state = {
      sessionId: config.sessionId ?? globalThis.crypto.randomUUID(),
      status: 'not_started',
      currentQuestionIndex: 0,
      followUpDepthForCurrentQuestion: 0,
      answers: [],
      followUpPromptsAsked: {},
      answeredTurnKeys: [],
      updatedAt: Date.now(),
    };
  }

  static fromState(
    state: SessionState,
    config: Omit<FlowEngineConfig, 'sessionId'>,
  ): InterviewFlowEngine {
    const engine = new InterviewFlowEngine({ ...config, sessionId: state.sessionId });
    engine.state = structuredClone(state);
    return engine;
  }

  getState(): SessionState {
    return structuredClone(this.state);
  }

  currentQuestion(): Question | undefined {
    return this.questions[this.state.currentQuestionIndex];
  }

  isComplete(): boolean {
    return this.state.status === 'completed';
  }

  start(): SessionState {
    if (this.state.status !== 'not_started') return this.getState();
    this.state = {
      ...this.state,
      status: 'in_progress',
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.events.emit('sessionStart', { sessionId: this.state.sessionId });
    return this.getState();
  }

  pause(): SessionState {
    this.applyExpiryIfNeeded();
    if (this.state.status !== 'in_progress') return this.getState();
    this.state = { ...this.state, status: 'paused', updatedAt: Date.now() };
    this.events.emit('sessionPause', { sessionId: this.state.sessionId });
    return this.getState();
  }

  resume(): SessionState {
    this.applyExpiryIfNeeded();
    if (this.state.status === 'expired') {
      throw new SessionExpiredError(
        `Session "${this.state.sessionId}" has expired and cannot be resumed.`,
      );
    }
    if (this.state.status !== 'paused') return this.getState();
    this.state = { ...this.state, status: 'in_progress', updatedAt: Date.now() };
    this.events.emit('sessionResume', { sessionId: this.state.sessionId });
    return this.getState();
  }

  /**
   * Voluntarily ends the session before every question has been answered —
   * a candidate or developer choosing to stop, rather than the flow
   * naturally advancing past the last question. Idempotent once the
   * session is already completed or expired; a no-op before it's started.
   */
  end(): SessionState {
    this.applyExpiryIfNeeded();
    if (this.state.status === 'completed' || this.state.status === 'expired') {
      return this.getState();
    }
    if (this.state.status === 'not_started') return this.getState();
    this.state = {
      ...this.state,
      status: 'completed',
      completedAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.events.emit('sessionEnd', { sessionId: this.state.sessionId });
    return this.getState();
  }

  /**
   * Idempotent: submitting again for the same question at the same
   * follow-up depth (double-click, network retry, duplicate tab) does not
   * record a second answer.
   */
  submitAnswer(input: SubmitAnswerInput): SessionState {
    this.applyExpiryIfNeeded();
    if (this.state.status === 'expired') {
      throw new SessionExpiredError(`Session "${this.state.sessionId}" has expired.`);
    }
    if (this.state.status !== 'in_progress') {
      throw new InterviewSdkError(
        `Cannot submit an answer while the session status is "${this.state.status}".`,
      );
    }

    const question = this.currentQuestion();
    if (!question) {
      throw new InterviewSdkError(
        'No current question to answer — the session may already be complete.',
      );
    }

    const turnKey = this.turnKey(question.id);
    if (this.state.answeredTurnKeys.includes(turnKey)) {
      return this.getState();
    }

    const answer: CandidateAnswer = {
      questionId: question.id,
      text: input.text,
      submittedAt: Date.now(),
      isSkipped: input.isSkipped,
      isSilence: input.isSilence,
    };

    this.state = {
      ...this.state,
      answers: [...this.state.answers, answer],
      answeredTurnKeys: [...this.state.answeredTurnKeys, turnKey],
      updatedAt: Date.now(),
    };
    return this.getState();
  }

  recordFollowUp(prompt: string): SessionState {
    const question = this.currentQuestion();
    if (!question) throw new InterviewSdkError('No current question to attach a follow-up to.');
    const maxDepth = question.maxFollowUps ?? this.maxFollowUpDepth;
    if (this.state.followUpDepthForCurrentQuestion >= maxDepth) {
      throw new InterviewSdkError(
        `Cannot record another follow-up: max depth (${maxDepth}) already reached for "${question.id}".`,
      );
    }

    const existing = this.state.followUpPromptsAsked[question.id] ?? [];
    this.state = {
      ...this.state,
      followUpPromptsAsked: {
        ...this.state.followUpPromptsAsked,
        [question.id]: [...existing, prompt],
      },
      followUpDepthForCurrentQuestion: this.state.followUpDepthForCurrentQuestion + 1,
      updatedAt: Date.now(),
    };
    this.events.emit('followUpGenerated', {
      sessionId: this.state.sessionId,
      questionId: question.id,
      prompt,
      depth: this.state.followUpDepthForCurrentQuestion,
    });
    return this.getState();
  }

  askedFollowUpsForCurrentQuestion(): string[] {
    const question = this.currentQuestion();
    if (!question) return [];
    return this.state.followUpPromptsAsked[question.id] ?? [];
  }

  advance(): SessionState {
    this.applyExpiryIfNeeded();
    const question = this.currentQuestion();
    if (question) {
      this.events.emit('questionAdvance', {
        sessionId: this.state.sessionId,
        questionId: question.id,
        index: this.state.currentQuestionIndex,
      });
    }

    const nextIndex = this.state.currentQuestionIndex + 1;
    if (nextIndex >= this.questions.length) {
      this.state = {
        ...this.state,
        status: 'completed',
        currentQuestionIndex: nextIndex,
        completedAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.events.emit('sessionEnd', { sessionId: this.state.sessionId });
    } else {
      this.state = {
        ...this.state,
        currentQuestionIndex: nextIndex,
        followUpDepthForCurrentQuestion: 0,
        updatedAt: Date.now(),
      };
    }
    return this.getState();
  }

  private turnKey(questionId: string): string {
    return `${questionId}#${this.state.followUpDepthForCurrentQuestion}`;
  }

  private applyExpiryIfNeeded(): void {
    if (!this.sessionTimeoutMs) return;
    if (this.state.status !== 'in_progress' && this.state.status !== 'paused') return;
    if (Date.now() - this.state.updatedAt > this.sessionTimeoutMs) {
      this.state = { ...this.state, status: 'expired', updatedAt: Date.now() };
      this.events.emit('sessionExpired', { sessionId: this.state.sessionId });
    }
  }
}
