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
    headers: new Headers({ 'Content-Type': 'application/json' }),
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

  it('extracts just the message from a JSON {error} body, not a raw double-stringified dump', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: 'GEMINI_API_KEY is not set.' },
        { ok: false, status: 500, statusText: 'Internal Server Error' },
      ),
    );
    const processor = new ServerModeProcessor({ fetchImpl });

    await expect(processor.processAnswer(input)).rejects.toThrow(
      'Interview server responded with 500 Internal Server Error: GEMINI_API_KEY is not set.',
    );
  });

  it('replaces an HTML error page with a clean message instead of dumping it verbatim into the UI', async () => {
    // A framework-level crash (e.g. Next.js's own dev-mode error overlay)
    // can return a full HTML page as the response body — thousands of
    // characters of <script> tags and a stack trace, never meant for a
    // candidate to see rendered as plain text on screen.
    const hugeHtmlBody = `<!DOCTYPE html><html>${'<script>x</script>'.repeat(200)}</html>`;
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
          json: async () => {
            throw new Error('not json');
          },
          text: async () => hugeHtmlBody,
        }) as unknown as Response,
    );
    const processor = new ServerModeProcessor({ fetchImpl });

    await expect(processor.processAnswer(input)).rejects.toThrow(
      'Interview server responded with 500 Internal Server Error: The server returned an unexpected error page instead of a JSON response — check your server logs for details.',
    );
  });

  it('truncates other unexpected non-JSON, non-HTML bodies instead of dumping them verbatim', async () => {
    const longPlainText = 'x'.repeat(2000);
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway',
          headers: new Headers({ 'Content-Type': 'text/plain' }),
          json: async () => {
            throw new Error('not json');
          },
          text: async () => longPlainText,
        }) as unknown as Response,
    );
    const processor = new ServerModeProcessor({ fetchImpl });

    let caught: unknown;
    try {
      await processor.processAnswer(input);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ServerModeRequestError);
    expect((caught as Error).message.length).toBeLessThan(600);
  });

  it('throws ServerModeRequestError when the response has no evaluation', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ somethingElse: true }));
    const processor = new ServerModeProcessor({ fetchImpl });

    await expect(processor.processAnswer(input)).rejects.toThrow(ServerModeRequestError);
  });
});
