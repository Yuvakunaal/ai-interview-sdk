import type { CandidateAnswer, Question, Rubric } from '@interview-sdk/core';
import { defineRubric } from '@interview-sdk/core';
import { describe, expect, it, vi } from 'vitest';
import { ServerModeProcessor, ServerModeRequestError } from './server-mode-processor.js';
import type { ProcessAnswerInput } from './types.js';

const rubric: Rubric = defineRubric([{ id: 'technical', label: 'Technical', weight: 1 }]);
const question: Question = { id: 'q1', prompt: 'Explain hash maps.' };
const answer: CandidateAnswer = { questionId: 'q1', text: 'It uses buckets.', submittedAt: 1 };

const input: ProcessAnswerInput = {
  question,
  rubric,
  answer,
  previousTurns: [],
  currentFollowUpDepth: 0,
  askedFollowUps: [],
};

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; statusText?: string } = {},
) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('ServerModeProcessor', () => {
  it('POSTs to the default endpoint with the answer payload', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ evaluation: { questionId: 'q1', totalScore: 80 } }),
    );
    const processor = new ServerModeProcessor({ fetchImpl });

    await processor.processAnswer(input);

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/interview/answer',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(input),
      }),
    );
  });

  it('allows overriding the endpoint and adding headers', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _options?: RequestInit) =>
      jsonResponse({ evaluation: { totalScore: 1 } }),
    );
    const processor = new ServerModeProcessor({
      fetchImpl,
      endpoint: '/custom/endpoint',
      headers: { Authorization: 'Bearer token' },
    });

    await processor.processAnswer(input);

    const [url, options] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('/custom/endpoint');
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer token' });
  });

  it('returns the evaluation and follow-up from the response body', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        evaluation: { questionId: 'q1', totalScore: 40 },
        followUp: { prompt: 'Can you elaborate?', targetsMissedConcepts: [] },
      }),
    );
    const processor = new ServerModeProcessor({ fetchImpl });

    const result = await processor.processAnswer(input);

    expect(result.evaluation.totalScore).toBe(40);
    expect(result.followUp?.prompt).toBe('Can you elaborate?');
  });

  it('throws ServerModeRequestError on a non-2xx response', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: 'unauthorized' },
        { ok: false, status: 401, statusText: 'Unauthorized' },
      ),
    );
    const processor = new ServerModeProcessor({ fetchImpl });

    await expect(processor.processAnswer(input)).rejects.toThrow(ServerModeRequestError);
  });

  it('throws ServerModeRequestError when the response has no evaluation', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ somethingElse: true }));
    const processor = new ServerModeProcessor({ fetchImpl });

    await expect(processor.processAnswer(input)).rejects.toThrow(ServerModeRequestError);
  });
});
