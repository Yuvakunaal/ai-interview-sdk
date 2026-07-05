'use client';

import { InterviewWidget } from '@interview-sdk/react';
import type { InterviewReport } from '@interview-sdk/react';
import { questions, rubric } from '../lib/questions';

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
      <InterviewWidget
        questions={questions}
        rubric={rubric}
        mode="server"
        apiBaseUrl="/api/interview/answer"
        onSessionEnd={(report: InterviewReport) => console.log('Session ended:', report)}
      />
    </main>
  );
}
