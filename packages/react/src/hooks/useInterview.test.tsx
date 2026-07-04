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
});
