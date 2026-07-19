import type { EvaluationResult, Question, RubricDimensionInput } from '@interview-sdk/core';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InterviewProcessor, ProcessAnswerResult } from '../processor/types.js';
import { useInterview } from './useInterview.js';

const questions: Question[] = [
  { id: 'q1', prompt: 'Explain hash maps.', concepts: ['hashing'] },
  { id: 'q2', prompt: 'Explain binary search.', concepts: ['sorted input'] },
];

const rubric: RubricDimensionInput[] = [{ id: 'technical', label: 'Technical', weight: 1 }];

function evaluation(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    questionId: 'q1',
    dimensionScores: { technical: 90 },
    totalScore: 90,
    conceptCoverage: [{ concept: 'hashing', covered: true }],
    contradictions: [],
    flags: [],
    ...overrides,
  };
}

function fakeProcessor(results: ProcessAnswerResult[]): InterviewProcessor {
  let call = 0;
  return {
    processAnswer: vi.fn(async () => {
      const result = results[Math.min(call, results.length - 1)]!;
      call += 1;
      return result;
    }),
  };
}

describe('useInterview', () => {
  it('fails loud on an empty questions array, same guarantee <InterviewWidget> gives', () => {
    const processor = fakeProcessor([{ evaluation: evaluation() }]);
    expect(() =>
      renderHook(() => useInterview({ questions: [], rubric, processor })),
    ).toThrow(/Invalid interview configuration/);
  });

  it('fails loud on an invalid rubric weight for headless (non-widget) usage', () => {
    const processor = fakeProcessor([{ evaluation: evaluation() }]);
    expect(() =>
      renderHook(() =>
        useInterview({
          questions,
          rubric: [{ id: 'technical', label: 'Technical', weight: -1 }],
          processor,
        }),
      ),
    ).toThrow(/Invalid interview configuration/);
  });

  it('starts not_started and moves to in_progress on start()', () => {
    const processor = fakeProcessor([{ evaluation: evaluation() }]);
    const { result } = renderHook(() => useInterview({ questions, rubric, processor }));

    expect(result.current.status).toBe('not_started');
    act(() => result.current.start());
    expect(result.current.status).toBe('in_progress');
  });

  it('exposes the current question and prompt', () => {
    const processor = fakeProcessor([{ evaluation: evaluation() }]);
    const { result } = renderHook(() => useInterview({ questions, rubric, processor }));

    act(() => result.current.start());

    expect(result.current.currentQuestion?.id).toBe('q1');
    expect(result.current.currentPrompt).toBe('Explain hash maps.');
    expect(result.current.isFollowUpPrompt).toBe(false);
  });

  it('advances to the next question when no follow-up is generated', async () => {
    const processor = fakeProcessor([{ evaluation: evaluation({ totalScore: 95 }) }]);
    const { result } = renderHook(() => useInterview({ questions, rubric, processor }));

    act(() => result.current.start());
    await act(async () => {
      await result.current.submitAnswer('It uses buckets.');
    });

    await waitFor(() => expect(result.current.currentQuestion?.id).toBe('q2'));
    expect(result.current.transcript).toHaveLength(1);
    expect(result.current.transcript[0]?.answer.text).toBe('It uses buckets.');
  });

  it('shows a follow-up prompt on the same question instead of advancing', async () => {
    const processor = fakeProcessor([
      {
        evaluation: evaluation({ totalScore: 40 }),
        followUp: { prompt: 'Can you say more about hashing?', targetsMissedConcepts: ['hashing'] },
      },
    ]);
    const { result } = renderHook(() => useInterview({ questions, rubric, processor }));

    act(() => result.current.start());
    await act(async () => {
      await result.current.submitAnswer('Not sure.');
    });

    await waitFor(() =>
      expect(result.current.currentPrompt).toBe('Can you say more about hashing?'),
    );
    expect(result.current.currentQuestion?.id).toBe('q1');
    expect(result.current.isFollowUpPrompt).toBe(true);
  });

  it('does not leak an unrelated earlier question into a later question\'s previousTurns', async () => {
    const processor = fakeProcessor([
      { evaluation: evaluation({ totalScore: 95 }) },
      { evaluation: evaluation({ totalScore: 10 }) },
    ]);
    const { result } = renderHook(() => useInterview({ questions, rubric, processor }));

    act(() => result.current.start());
    await act(async () => {
      await result.current.submitAnswer('It uses buckets.');
    });
    await waitFor(() => expect(result.current.currentQuestion?.id).toBe('q2'));

    await act(async () => {
      await result.current.submitAnswer('It halves the search space each time.');
    });
    await waitFor(() => expect(processor.processAnswer).toHaveBeenCalledTimes(2));

    // q2 is a brand-new top-level question with no relationship to q1 — it
    // must not be handed q1's answer as conversational context, the way the
    // whole prior transcript used to be included unconditionally.
    const secondCallInput = vi.mocked(processor.processAnswer).mock.calls[1]![0];
    expect(secondCallInput.previousTurns).toEqual([]);
  });

  it('includes this question\'s own prior turn as previousTurns context for its follow-up', async () => {
    const processor = fakeProcessor([
      {
        evaluation: evaluation({ totalScore: 40 }),
        followUp: { prompt: 'Can you say more about hashing?', targetsMissedConcepts: ['hashing'] },
      },
      { evaluation: evaluation({ totalScore: 60 }) },
    ]);
    const { result } = renderHook(() => useInterview({ questions, rubric, processor }));

    act(() => result.current.start());
    await act(async () => {
      await result.current.submitAnswer('Not sure.');
    });
    await waitFor(() => expect(result.current.isFollowUpPrompt).toBe(true));

    await act(async () => {
      await result.current.submitAnswer('Buckets and chaining.');
    });
    await waitFor(() => expect(processor.processAnswer).toHaveBeenCalledTimes(2));

    // The follow-up is still fundamentally about q1, so its own original
    // answer is exactly the context the model should see for the follow-up.
    const secondCallInput = vi.mocked(processor.processAnswer).mock.calls[1]![0];
    expect(secondCallInput.previousTurns).toEqual([
      { question: questions[0], answer: expect.objectContaining({ text: 'Not sure.' }) },
    ]);
  });

  it('builds and reports the final report once the last question is answered', async () => {
    const onSessionEnd = vi.fn();
    const processor = fakeProcessor([{ evaluation: evaluation({ totalScore: 100 }) }]);
    const { result } = renderHook(() =>
      useInterview({ questions: [questions[0]!], rubric, processor, onSessionEnd }),
    );

    act(() => result.current.start());
    await act(async () => {
      await result.current.submitAnswer('It uses buckets.');
    });

    await waitFor(() => expect(result.current.status).toBe('completed'));
    expect(result.current.report?.totalScore).toBe(100);
    expect(onSessionEnd).toHaveBeenCalledWith(expect.objectContaining({ totalScore: 100 }));
  });

  it('ends the interview early and builds a report from whatever was answered so far', async () => {
    const onSessionEnd = vi.fn();
    const processor = fakeProcessor([{ evaluation: evaluation({ totalScore: 80 }) }]);
    const { result } = renderHook(() => useInterview({ questions, rubric, processor, onSessionEnd }));

    act(() => result.current.start());
    await act(async () => {
      await result.current.submitAnswer('It uses buckets.');
    });
    await waitFor(() => expect(result.current.currentQuestion?.id).toBe('q2'));

    // Only q1 was ever answered — q2 never gets a turn.
    act(() => result.current.endInterview());

    expect(result.current.status).toBe('completed');
    expect(result.current.report?.transcript).toHaveLength(1);
    expect(onSessionEnd).toHaveBeenCalledTimes(1);
  });

  it('does not rebuild the report if endInterview is called after natural completion', async () => {
    const onSessionEnd = vi.fn();
    const processor = fakeProcessor([{ evaluation: evaluation({ totalScore: 100 }) }]);
    const { result } = renderHook(() =>
      useInterview({ questions: [questions[0]!], rubric, processor, onSessionEnd }),
    );

    act(() => result.current.start());
    await act(async () => {
      await result.current.submitAnswer('It uses buckets.');
    });
    await waitFor(() => expect(result.current.status).toBe('completed'));

    const firstReport = result.current.report;
    act(() => result.current.endInterview());

    expect(result.current.report).toBe(firstReport);
    expect(onSessionEnd).toHaveBeenCalledTimes(1);
  });

  it('ignores a second submitAnswer call while the first is still in flight', async () => {
    let resolveFirst!: (value: ProcessAnswerResult) => void;
    const processor: InterviewProcessor = {
      processAnswer: vi.fn(
        () => new Promise<ProcessAnswerResult>((resolve) => (resolveFirst = resolve)),
      ),
    };
    const { result } = renderHook(() => useInterview({ questions, rubric, processor }));

    act(() => result.current.start());

    let firstCall!: Promise<void>;
    act(() => {
      firstCall = result.current.submitAnswer('It uses buckets.');
    });
    expect(result.current.isProcessing).toBe(true);

    await act(async () => {
      await result.current.submitAnswer('A second, racing submission.');
    });
    expect(processor.processAnswer).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst({ evaluation: evaluation({ totalScore: 90 }) });
      await firstCall;
    });
    expect(result.current.transcript).toHaveLength(1);
  });

  it('implicitly retries when submitAnswer is called again for a turn whose last attempt failed', async () => {
    let attempt = 0;
    const processor: InterviewProcessor = {
      processAnswer: vi.fn(async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('network blip');
        return { evaluation: evaluation({ totalScore: 90 }) };
      }),
    };
    const { result } = renderHook(() => useInterview({ questions, rubric, processor }));

    act(() => result.current.start());
    await act(async () => {
      await result.current.submitAnswer('It uses buckets.');
    });
    expect(result.current.error?.message).toBe('network blip');

    await act(async () => {
      await result.current.submitAnswer('It uses buckets.');
    });

    expect(processor.processAnswer).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeUndefined();
    expect(result.current.transcript).toHaveLength(1);
  });

  it('surfaces a processing error without advancing, and retryLastAnswer re-attempts it', async () => {
    let shouldFail = true;
    const processor: InterviewProcessor = {
      processAnswer: vi.fn(async () => {
        if (shouldFail) {
          shouldFail = false;
          throw new Error('network blip');
        }
        return { evaluation: evaluation({ totalScore: 85 }) };
      }),
    };
    const { result } = renderHook(() => useInterview({ questions, rubric, processor }));

    act(() => result.current.start());
    await act(async () => {
      await result.current.submitAnswer('It uses buckets.');
    });

    expect(result.current.error?.message).toBe('network blip');
    expect(result.current.currentQuestion?.id).toBe('q1');

    await act(async () => {
      await result.current.retryLastAnswer();
    });

    expect(result.current.error).toBeUndefined();
    await waitFor(() => expect(result.current.currentQuestion?.id).toBe('q2'));
  });

  it('defers advancing past a question if the candidate pauses while it is being scored, and applies it on resume', async () => {
    let resolveScoring!: (value: ProcessAnswerResult) => void;
    const processor: InterviewProcessor = {
      processAnswer: vi.fn(
        () => new Promise<ProcessAnswerResult>((resolve) => (resolveScoring = resolve)),
      ),
    };
    const { result } = renderHook(() => useInterview({ questions, rubric, processor }));

    act(() => result.current.start());

    let submitCall!: Promise<void>;
    act(() => {
      submitCall = result.current.submitAnswer('It uses buckets.');
    });

    // Candidate pauses while the AI is still scoring the in-flight answer.
    act(() => result.current.pause());
    expect(result.current.status).toBe('paused');

    await act(async () => {
      resolveScoring({ evaluation: evaluation({ totalScore: 90 }) });
      await submitCall;
    });

    // The real score lands immediately — it isn't lost just because the
    // session is paused.
    expect(result.current.transcript).toHaveLength(1);
    // But the question index must not silently jump forward behind the
    // paused screen.
    expect(result.current.status).toBe('paused');
    expect(result.current.currentQuestion?.id).toBe('q1');

    act(() => result.current.resume());

    expect(result.current.status).toBe('in_progress');
    expect(result.current.currentQuestion?.id).toBe('q2');
  });

  it('does not crash when resuming a session that expired while paused', () => {
    vi.useFakeTimers();
    try {
      const processor = fakeProcessor([{ evaluation: evaluation() }]);
      const { result } = renderHook(() =>
        useInterview({ questions, rubric, processor, sessionTimeoutMs: 1000 }),
      );

      act(() => result.current.start());
      act(() => result.current.pause());
      expect(result.current.status).toBe('paused');

      vi.advanceTimersByTime(2000);

      // The flow engine deliberately throws SessionExpiredError from
      // resume() on an expired session — the hook must catch it and turn it
      // into visible state, not let it escape as an uncaught synchronous
      // throw from an event-handler callback (which no error boundary can
      // catch).
      expect(() => {
        act(() => result.current.resume());
      }).not.toThrow();

      expect(result.current.status).toBe('expired');
      expect(result.current.error).toBeInstanceOf(Error);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not leave an unhandled rejection when submitting an answer after the session has expired', async () => {
    vi.useFakeTimers();
    try {
      const processor = fakeProcessor([{ evaluation: evaluation() }]);
      const { result } = renderHook(() =>
        useInterview({ questions, rubric, processor, sessionTimeoutMs: 1000 }),
      );

      act(() => result.current.start());
      vi.advanceTimersByTime(2000);

      await act(async () => {
        await result.current.submitAnswer('too late');
      });

      expect(result.current.status).toBe('expired');
      expect(result.current.error).toBeInstanceOf(Error);
    } finally {
      vi.useRealTimers();
    }
  });

  it('preserves the already-scored answer in the final report if the interview ends instead of resuming', async () => {
    let resolveScoring!: (value: ProcessAnswerResult) => void;
    const processor: InterviewProcessor = {
      processAnswer: vi.fn(
        () => new Promise<ProcessAnswerResult>((resolve) => (resolveScoring = resolve)),
      ),
    };
    const { result } = renderHook(() => useInterview({ questions, rubric, processor }));

    act(() => result.current.start());

    let submitCall!: Promise<void>;
    act(() => {
      submitCall = result.current.submitAnswer('It uses buckets.');
    });

    act(() => result.current.pause());

    await act(async () => {
      resolveScoring({ evaluation: evaluation({ totalScore: 90 }) });
      await submitCall;
    });

    // Candidate never resumes — they end the interview straight from pause.
    act(() => result.current.endInterview());

    expect(result.current.status).toBe('completed');
    expect(result.current.report?.transcript).toHaveLength(1);
  });

  it('does not double-fire onSessionEnd if endInterview is called while an answer is still being scored', async () => {
    const onSessionEnd = vi.fn();
    let resolveScoring!: (value: ProcessAnswerResult) => void;
    const processor: InterviewProcessor = {
      processAnswer: vi.fn(
        () => new Promise<ProcessAnswerResult>((resolve) => (resolveScoring = resolve)),
      ),
    };
    const { result } = renderHook(() =>
      useInterview({ questions, rubric, processor, onSessionEnd }),
    );

    act(() => result.current.start());

    let submitCall!: Promise<void>;
    act(() => {
      submitCall = result.current.submitAnswer('It uses buckets.');
    });

    // Candidate ends the interview outright while the last answer is still
    // in flight, instead of pausing.
    act(() => result.current.endInterview());
    expect(result.current.status).toBe('completed');
    expect(onSessionEnd).toHaveBeenCalledTimes(1);
    const reportAtEnd = result.current.report;

    await act(async () => {
      resolveScoring({ evaluation: evaluation({ totalScore: 90 }) });
      await submitCall;
    });

    // The score still lands (real data isn't discarded)...
    expect(result.current.transcript).toHaveLength(1);
    // ...but it must not silently re-advance an already-completed session
    // or fire the developer's callback a second time with a different report.
    expect(onSessionEnd).toHaveBeenCalledTimes(1);
    expect(result.current.report).toBe(reportAtEnd);
  });

  it('resumes an equivalent session from a snapshot taken mid-interview', async () => {
    const processor = fakeProcessor([{ evaluation: evaluation({ totalScore: 88 }) }]);
    const first = renderHook(() => useInterview({ questions, rubric, processor }));

    act(() => first.result.current.start());
    await act(async () => {
      await first.result.current.submitAnswer('It uses buckets.');
    });
    expect(first.result.current.currentQuestion?.id).toBe('q2');
    expect(first.result.current.transcript).toHaveLength(1);

    const snapshot = first.result.current.getSnapshot();

    // A brand-new hook instance (e.g. after a page refresh) reconstructed
    // purely from the persisted snapshot, no other shared state.
    const resumed = renderHook(() =>
      useInterview({ questions, rubric, processor, initialSnapshot: snapshot }),
    );

    expect(resumed.result.current.status).toBe('in_progress');
    expect(resumed.result.current.currentQuestion?.id).toBe('q2');
    expect(resumed.result.current.transcript).toHaveLength(1);
    expect(resumed.result.current.transcript[0]!.evaluation.totalScore).toBe(88);
    expect(resumed.result.current.getSnapshot().flowState.sessionId).toBe(
      first.result.current.getSnapshot().flowState.sessionId,
    );
  });

  it('resuming a snapshot whose sessionTimeoutMs has already elapsed shows expired immediately, not in_progress', async () => {
    const processor = fakeProcessor([{ evaluation: evaluation() }]);
    const first = renderHook(() =>
      useInterview({ questions, rubric, processor, sessionTimeoutMs: 1000 }),
    );
    act(() => first.result.current.start());
    const staleSnapshot = first.result.current.getSnapshot();
    staleSnapshot.flowState.updatedAt = Date.now() - 5000;

    const resumed = renderHook(() =>
      useInterview({
        questions,
        rubric,
        processor,
        sessionTimeoutMs: 1000,
        initialSnapshot: staleSnapshot,
      }),
    );

    // Must read as expired on the very first render, not just once the
    // candidate tries (and fails) to submit another answer.
    expect(resumed.result.current.status).toBe('expired');
  });

  it('attaches getIntegritySignals() output to the report on completion', async () => {
    const processor = fakeProcessor([{ evaluation: evaluation() }]);
    const getIntegritySignals = vi.fn(() => ({
      tabSwitchCount: 3,
      tabSwitchTimestamps: [1, 2, 3],
      pasteEvents: [{ length: 42, timestamp: 5 }],
    }));
    const { result } = renderHook(() =>
      useInterview({ questions, rubric, processor, getIntegritySignals }),
    );

    act(() => result.current.start());
    await act(async () => {
      await result.current.submitAnswer('It uses buckets.');
    });
    act(() => result.current.endInterview());

    expect(result.current.report?.integritySignals).toEqual({
      tabSwitchCount: 3,
      tabSwitchTimestamps: [1, 2, 3],
      pasteEvents: [{ length: 42, timestamp: 5 }],
    });
  });

  it('exposes the underlying event emitter and fires scoreComputed for a real answer', async () => {
    const processor = fakeProcessor([{ evaluation: evaluation({ totalScore: 77 }) }]);
    const { result } = renderHook(() => useInterview({ questions, rubric, processor }));

    const onScoreComputed = vi.fn();
    result.current.events.on('scoreComputed', onScoreComputed);

    act(() => result.current.start());
    await act(async () => {
      await result.current.submitAnswer('It uses buckets.');
    });

    expect(onScoreComputed).toHaveBeenCalledTimes(1);
    expect(onScoreComputed).toHaveBeenCalledWith(
      expect.objectContaining({ questionId: 'q1', result: expect.objectContaining({ totalScore: 77 }) }),
    );
  });
});
