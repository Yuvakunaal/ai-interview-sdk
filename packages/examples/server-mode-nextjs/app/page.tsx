'use client';

import { InterviewWidget } from '@interview-sdk/react';
import type { InterviewReport } from '@interview-sdk/react';
import { questions, rubric } from '../lib/questions';

/**
 * The report `onSessionEnd` hands you is assembled client-side from
 * per-turn evaluations — trustworthy as a UI preview, but a browser can't
 * prove it wasn't edited before this fires. Sending it to
 * /api/interview/complete lets the server re-verify each evaluation's HMAC
 * signature (attached by /api/interview/answer) before treating the report
 * as final — see that route for what "final" should mean in your own app
 * (persisting it, rejecting a tampered one, etc).
 */
async function submitFinalReport(report: InterviewReport): Promise<void> {
  const response = await fetch('/api/interview/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  });
  const result = (await response.json()) as { verified: boolean };
  console.log(
    response.ok
      ? `Session ${report.sessionId} verified and accepted (score: ${report.totalScore}).`
      : `Session ${report.sessionId} REJECTED — signature verification failed.`,
    result,
  );
}

export default function Page() {
  return (
    <main>
      <h1>AI Interview SDK — Server Mode example</h1>
      <p>
        <code>mode=&quot;server&quot;</code>: every answer is POSTed to{' '}
        <code>/api/interview/answer</code>, which runs on this Next.js server via{' '}
        <code>@interview-sdk/server</code>. The browser never sees an AI provider key or a writable
        score object — see <code>app/api/interview/answer/route.ts</code>.
      </p>
      <p>
        The route uses a mock adapter by default so this runs with zero setup. Swap in a real{' '}
        <code>@interview-sdk/adapter-*</code> — see the TODO in that file — for production.
      </p>
      <p>
        When the interview finishes, the report is sent to{' '}
        <code>/api/interview/complete</code>, which re-verifies every per-turn evaluation&apos;s
        signature before accepting it — see that route and set{' '}
        <code>INTERVIEW_SIGNING_SECRET</code> to see it in action.
      </p>
      <InterviewWidget
        questions={questions}
        rubric={rubric}
        mode="server"
        apiBaseUrl="/api/interview/answer"
        onSessionEnd={(report: InterviewReport) => {
          void submitFinalReport(report);
        }}
      />
    </main>
  );
}
