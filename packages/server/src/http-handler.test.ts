import type { AIProviderAdapter, Question } from '@interview-sdk/core';
import { ProviderOverloadedError } from '@interview-sdk/core';
import { describe, expect, it, vi } from 'vitest';
import { ServerAnswerProcessor } from './answer-processor.js';
import { createInterviewAnswerHandler } from './http-handler.js';

const questions: Question[] = [{ id: 'q1', prompt: 'Explain hash maps.', concepts: ['hashing'] }];
const rubric = [{ id: 'technical', label: 'Technical', weight: 1 }];

function fakeAdapter(responses: string[]): AIProviderAdapter {
  let call = 0;
  return {
    id: 'fake',
    complete: vi.fn(async () => {
      const text = responses[Math.min(call, responses.length - 1)] ?? '{}';
      call += 1;
      return { text };
    }),
  };
}

function postRequest(body: unknown): Request {
  return new Request('https://example.com/api/interview/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('createInterviewAnswerHandler', () => {
  it('returns 200 with the evaluation for a valid request', async () => {
    const adapter = fakeAdapter([JSON.stringify({ dimensionScores: { technical: 90 } })]);
    const processor = new ServerAnswerProcessor({ questions, rubric, adapter });
    const handler = createInterviewAnswerHandler(processor);

    const response = await handler(
      postRequest({ answer: { questionId: 'q1', text: 'It uses buckets.', submittedAt: 1 } }),
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { evaluation: { totalScore: number } };
    expect(data.evaluation.totalScore).toBeCloseTo(90);
  });

  it('returns 400 for a malformed JSON body', async () => {
    const processor = new ServerAnswerProcessor({
      questions,
      rubric,
      adapter: fakeAdapter(['{}']),
    });
    const handler = createInterviewAnswerHandler(processor);

    const request = new Request('https://example.com/api/interview/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });

    const response = await handler(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when answer.questionId is missing', async () => {
    const processor = new ServerAnswerProcessor({
      questions,
      rubric,
      adapter: fakeAdapter(['{}']),
    });
    const handler = createInterviewAnswerHandler(processor);

    const response = await handler(postRequest({ answer: { text: 'no id' } }));
    expect(response.status).toBe(400);
  });

  it('returns 400 for an unknown question id', async () => {
    const processor = new ServerAnswerProcessor({
      questions,
      rubric,
      adapter: fakeAdapter(['{}']),
    });
    const handler = createInterviewAnswerHandler(processor);

    const response = await handler(
      postRequest({ answer: { questionId: 'nope', text: 'hi', submittedAt: 1 } }),
    );

    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toMatch(/No configured question/);
  });

  it('returns 502 when the AI provider adapter fails', async () => {
    const adapter: AIProviderAdapter = {
      id: 'fake',
      complete: vi.fn(async () => {
        throw new ProviderOverloadedError('overloaded', 'fake');
      }),
    };
    const onError = vi.fn();
    const processor = new ServerAnswerProcessor({ questions, rubric, adapter });
    const handler = createInterviewAnswerHandler(processor, { onError });

    const response = await handler(
      postRequest({ answer: { questionId: 'q1', text: 'It uses buckets.', submittedAt: 1 } }),
    );

    expect(response.status).toBe(502);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('returns 500 for an unexpected error and calls onError', async () => {
    const adapter: AIProviderAdapter = {
      id: 'fake',
      complete: vi.fn(async () => {
        throw new Error('boom');
      }),
    };
    const onError = vi.fn();
    const processor = new ServerAnswerProcessor({ questions, rubric, adapter });
    const handler = createInterviewAnswerHandler(processor, { onError });

    const response = await handler(
      postRequest({ answer: { questionId: 'q1', text: 'It uses buckets.', submittedAt: 1 } }),
    );

    expect(response.status).toBe(500);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
