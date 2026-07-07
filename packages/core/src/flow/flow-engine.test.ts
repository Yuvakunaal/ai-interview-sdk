import { describe, expect, it, vi } from 'vitest';
import { ConfigValidationError, InterviewSdkError, SessionExpiredError } from '../errors.js';
import type { Question } from '../types.js';
import { InterviewFlowEngine, type SessionState } from './flow-engine.js';

const questions: Question[] = [
  { id: 'q1', prompt: 'Question one' },
  { id: 'q2', prompt: 'Question two' },
];

describe('InterviewFlowEngine construction', () => {
  it('fails loud on an empty question list', () => {
    expect(() => new InterviewFlowEngine({ questions: [] })).toThrow(ConfigValidationError);
  });

  it('fails loud on a blank question id, matching validateInterviewConfig, instead of silently accepting it', () => {
    // validateInterviewConfig (config/validate-config.ts) already rejects a
    // blank id, but that check isn't shared — constructing the engine
    // directly (bypassing that validator, e.g. from a headless caller)
    // let a blank id through, becoming a real turn/follow-up-map key.
    expect(() => new InterviewFlowEngine({ questions: [{ id: '', prompt: 'A' }] })).toThrow(
      ConfigValidationError,
    );
    expect(() => new InterviewFlowEngine({ questions: [{ id: '   ', prompt: 'A' }] })).toThrow(
      ConfigValidationError,
    );
  });

  it('fails loud on duplicate question ids', () => {
    expect(
      () =>
        new InterviewFlowEngine({
          questions: [
            { id: 'q1', prompt: 'A' },
            { id: 'q1', prompt: 'B' },
          ],
        }),
    ).toThrow(/Duplicate question id/);
  });

  it('fails loud on an invalid sessionTimeoutMs instead of silently misbehaving', () => {
    // A negative value would otherwise expire the session almost
    // immediately (Date.now() - updatedAt > a negative number is true right
    // away); this must be caught by the engine itself, not only by the
    // separate validateInterviewConfig, which a direct/headless caller can
    // bypass.
    expect(() => new InterviewFlowEngine({ questions, sessionTimeoutMs: -1 })).toThrow(
      ConfigValidationError,
    );
    expect(() => new InterviewFlowEngine({ questions, sessionTimeoutMs: Number.NaN })).toThrow(
      ConfigValidationError,
    );
  });
});

describe('InterviewFlowEngine session lifecycle', () => {
  it('starts a session, transitioning to in_progress and emitting sessionStart', () => {
    const engine = new InterviewFlowEngine({ questions });
    const handler = vi.fn();
    engine.events.on('sessionStart', handler);

    const state = engine.start();

    expect(state.status).toBe('in_progress');
    expect(state.startedAt).toBeDefined();
    expect(handler).toHaveBeenCalledWith({ sessionId: state.sessionId });
  });

  it('is idempotent when start() is called twice', () => {
    const engine = new InterviewFlowEngine({ questions });
    const first = engine.start();
    const second = engine.start();
    expect(second.startedAt).toBe(first.startedAt);
  });

  it('pauses and resumes a session', () => {
    const engine = new InterviewFlowEngine({ questions });
    engine.start();

    const paused = engine.pause();
    expect(paused.status).toBe('paused');

    const resumed = engine.resume();
    expect(resumed.status).toBe('in_progress');
  });

  it('ends a session early, before every question has been answered', () => {
    const engine = new InterviewFlowEngine({ questions });
    const handler = vi.fn();
    engine.start();
    engine.events.on('sessionEnd', handler);

    const ended = engine.end();

    expect(ended.status).toBe('completed');
    expect(ended.completedAt).toBeDefined();
    expect(ended.currentQuestionIndex).toBe(0);
    expect(handler).toHaveBeenCalledWith({ sessionId: ended.sessionId });
  });

  it('ends a paused session too', () => {
    const engine = new InterviewFlowEngine({ questions });
    engine.start();
    engine.pause();

    const ended = engine.end();
    expect(ended.status).toBe('completed');
  });

  it('is idempotent when end() is called on an already-completed session', () => {
    const engine = new InterviewFlowEngine({ questions });
    engine.start();
    const first = engine.end();
    const second = engine.end();
    expect(second.completedAt).toBe(first.completedAt);
  });

  it('is a no-op when end() is called before the session has started', () => {
    const engine = new InterviewFlowEngine({ questions });
    const ended = engine.end();
    expect(ended.status).toBe('not_started');
    expect(ended.completedAt).toBeUndefined();
  });

  it('advances through questions and completes after the last one', () => {
    const engine = new InterviewFlowEngine({ questions });
    engine.start();

    const afterFirst = engine.advance();
    expect(afterFirst.currentQuestionIndex).toBe(1);
    expect(afterFirst.status).toBe('in_progress');

    const afterSecond = engine.advance();
    expect(afterSecond.status).toBe('completed');
    expect(afterSecond.completedAt).toBeDefined();
    expect(engine.isComplete()).toBe(true);
  });

  it('resets follow-up depth when advancing to the next question', () => {
    const engine = new InterviewFlowEngine({ questions, maxFollowUpDepth: 2 });
    engine.start();
    engine.recordFollowUp('Can you elaborate?');
    expect(engine.getState().followUpDepthForCurrentQuestion).toBe(1);

    const next = engine.advance();
    expect(next.followUpDepthForCurrentQuestion).toBe(0);
  });
});

describe('InterviewFlowEngine.submitAnswer', () => {
  it('records an answer for the current question', () => {
    const engine = new InterviewFlowEngine({ questions });
    engine.start();

    const state = engine.submitAnswer({ text: 'My answer' });
    expect(state.answers).toHaveLength(1);
    expect(state.answers[0]).toMatchObject({ questionId: 'q1', text: 'My answer' });
  });

  it('prevents a duplicate submission for the same question/turn (idempotent, not a second record)', () => {
    const engine = new InterviewFlowEngine({ questions });
    engine.start();

    engine.submitAnswer({ text: 'First try' });
    const state = engine.submitAnswer({ text: 'Resubmitted due to network retry' });

    expect(state.answers).toHaveLength(1);
    expect(state.answers[0]?.text).toBe('First try');
  });

  it('allows a new answer after a follow-up advances the turn depth', () => {
    const engine = new InterviewFlowEngine({ questions, maxFollowUpDepth: 2 });
    engine.start();
    engine.submitAnswer({ text: 'Initial answer' });
    engine.recordFollowUp('Can you say more?');

    const state = engine.submitAnswer({ text: 'Follow-up answer' });
    expect(state.answers).toHaveLength(2);
  });

  it('throws when submitting before the session has started', () => {
    const engine = new InterviewFlowEngine({ questions });
    expect(() => engine.submitAnswer({ text: 'Too early' })).toThrow(InterviewSdkError);
  });

  it('throws a clear error rather than crashing if restored state has no current question (tampered/corrupted state)', () => {
    const engine = new InterviewFlowEngine({ questions });
    engine.start();
    const corruptedState: SessionState = { ...engine.getState(), currentQuestionIndex: 99 };
    const restored = InterviewFlowEngine.fromState(corruptedState, { questions });

    expect(() => restored.submitAnswer({ text: 'anything' })).toThrow(/No current question/);
  });

  it('throws when submitting to a paused session', () => {
    const engine = new InterviewFlowEngine({ questions });
    engine.start();
    engine.pause();
    expect(() => engine.submitAnswer({ text: 'nope' })).toThrow(InterviewSdkError);
  });
});

describe('InterviewFlowEngine.recordFollowUp', () => {
  it('throws once max follow-up depth is reached for the current question', () => {
    const engine = new InterviewFlowEngine({ questions, maxFollowUpDepth: 1 });
    engine.start();
    engine.recordFollowUp('Follow-up 1');
    expect(() => engine.recordFollowUp('Follow-up 2')).toThrow(/max depth/);
  });

  it('tracks asked follow-ups per question for repeat-prevention lookups', () => {
    const engine = new InterviewFlowEngine({ questions, maxFollowUpDepth: 2 });
    engine.start();
    engine.recordFollowUp('Follow-up 1');
    expect(engine.askedFollowUpsForCurrentQuestion()).toEqual(['Follow-up 1']);
  });

  it("a question's own maxFollowUps overrides the session-wide maxFollowUpDepth", () => {
    const questionsWithOverride: Question[] = [
      { id: 'q1', prompt: 'Question one', maxFollowUps: 0 },
      { id: 'q2', prompt: 'Question two' },
    ];
    const engine = new InterviewFlowEngine({
      questions: questionsWithOverride,
      maxFollowUpDepth: 2,
    });
    engine.start();
    expect(() => engine.recordFollowUp('Follow-up 1')).toThrow(/max depth \(0\)/);
  });
});

describe('InterviewFlowEngine session expiration', () => {
  it('expires a session whose last update exceeds sessionTimeoutMs, and resume() throws', () => {
    const engine = new InterviewFlowEngine({ questions, sessionTimeoutMs: 1000 });
    engine.start();
    const staleState: SessionState = { ...engine.getState(), updatedAt: Date.now() - 5000 };
    const resumedEngine = InterviewFlowEngine.fromState(staleState, {
      questions,
      sessionTimeoutMs: 1000,
    });

    expect(() => resumedEngine.resume()).toThrow(SessionExpiredError);
    expect(resumedEngine.getState().status).toBe('expired');
  });

  it('rejects submitAnswer on an expired session', () => {
    const engine = new InterviewFlowEngine({ questions, sessionTimeoutMs: 1000 });
    engine.start();
    const staleState: SessionState = { ...engine.getState(), updatedAt: Date.now() - 5000 };
    const resumedEngine = InterviewFlowEngine.fromState(staleState, {
      questions,
      sessionTimeoutMs: 1000,
    });

    expect(() => resumedEngine.submitAnswer({ text: 'too late' })).toThrow(SessionExpiredError);
  });
});

describe('InterviewFlowEngine persistence (auto-save / resume after refresh)', () => {
  it('round-trips state through getState()/fromState() without losing progress', () => {
    const engine = new InterviewFlowEngine({ questions });
    engine.start();
    engine.submitAnswer({ text: 'Answer 1' });
    engine.advance();

    const snapshot = engine.getState();
    const restored = InterviewFlowEngine.fromState(snapshot, { questions });

    expect(restored.getState()).toEqual(snapshot);
    expect(restored.currentQuestion()?.id).toBe('q2');
  });

  it('getState() returns a defensive copy that cannot mutate internal state', () => {
    const engine = new InterviewFlowEngine({ questions });
    engine.start();

    const state = engine.getState();
    state.status = 'completed';
    state.answers.push({ questionId: 'q1', text: 'injected', submittedAt: 0 });

    expect(engine.getState().status).toBe('in_progress');
    expect(engine.getState().answers).toHaveLength(0);
  });
});
