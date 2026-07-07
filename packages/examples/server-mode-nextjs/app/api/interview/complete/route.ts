import type { EvaluationResult } from '@interview-sdk/core';
import { verify } from '@interview-sdk/server';

interface CompleteRequestBody {
  sessionId: string;
  totalScore: number;
  transcript: Array<{ evaluation: EvaluationResult & { signature?: string } }>;
}

/**
 * Called once by the widget's `onSessionEnd` (see app/page.tsx) with the
 * full client-assembled report. The browser is not a trusted execution
 * environment — a motivated candidate could edit the aggregate totalScore
 * in memory before this fires — so before persisting anything, re-derive
 * trust from the one thing the browser can't forge: the HMAC signature
 * `/api/interview/answer` attached to each per-turn evaluation (only when
 * INTERVIEW_SIGNING_SECRET is set there). Any entry whose signature doesn't
 * verify means the stored evaluation isn't the one this server computed.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as CompleteRequestBody;
  const secret = process.env.INTERVIEW_SIGNING_SECRET;

  if (secret) {
    for (const entry of body.transcript) {
      const { signature, ...evaluation } = entry.evaluation;
      if (!signature || !verify(evaluation, signature, secret)) {
        return Response.json(
          { error: 'A stored evaluation failed signature verification.', verified: false },
          { status: 400 },
        );
      }
    }
  }

  // Every per-turn evaluation is now proven untampered. This is the point
  // to persist the report to your own database — this example just logs it.
  console.log(`Verified interview report for session ${body.sessionId}:`, body.totalScore);

  return Response.json({ verified: true });
}
