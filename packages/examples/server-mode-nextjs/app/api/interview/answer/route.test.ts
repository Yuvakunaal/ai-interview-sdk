import { describe, expect, it } from 'vitest';
import { POST } from './route.js';

/**
 * Guards the "zero setup" promise every doc makes about this example
 * (root README, packages/examples/README.md, this package's own README,
 * .env.example, and the docs production page): a fresh checkout with no
 * .env.local and no provider API key must still answer successfully. This
 * regressed once (a previous revision required a real GROQ_API_KEY and
 * threw otherwise) without any doc being updated to match.
 */
describe('POST /api/interview/answer', () => {
  it('scores an answer with zero environment variables set', async () => {
    expect(process.env.GROQ_API_KEY).toBeUndefined();
    expect(process.env.OPENAI_API_KEY).toBeUndefined();

    const request = new Request('http://localhost/api/interview/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answer: { questionId: 'q2', text: 'ALTER TABLE ... RENAME COLUMN', submittedAt: Date.now() },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { evaluation: { totalScore: number } };
    expect(typeof body.evaluation.totalScore).toBe('number');
  });
});
