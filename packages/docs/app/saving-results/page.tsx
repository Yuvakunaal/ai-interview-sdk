import type { Metadata } from 'next';
import Link from 'next/link';
import { Callout } from '../../components/Callout';
import { CodeBlock } from '../../components/CodeBlock';

export const metadata: Metadata = { title: 'Saving results to your database' };

export default function SavingResults() {
  return (
    <>
      <p className="docs-eyebrow">Your database · your backend</p>
      <h1>Saving results to your database</h1>
      <p className="docs-lede">
        Yes — the full interview report is yours to store. The SDK holds no database of its own
        (Zero-Infra Guarantee), which means every result flows into <em>your</em> backend and{' '}
        <em>your</em> database, linked to your own users however you like. This page is the
        complete flow.
      </p>

      <h2>What you get at the end of an interview</h2>
      <p>
        When the candidate finishes, <code>InterviewWidget</code> calls your{' '}
        <code>onSessionEnd</code> callback with the complete <code>InterviewReport</code>:
      </p>
      <CodeBlock lang="ts" filename="the report shape">
        {`interface InterviewReport {
  sessionId: string;
  totalScore: number;                          // 0–100, rubric-weighted
  dimensionAverages: Record<string, number>;   // per rubric dimension
  strengths: string[];
  weaknesses: string[];
  missedConcepts: string[];
  transcript: TranscriptEntry[];               // every question, answer,
}                                              // follow-up, and its evaluation`}
      </CodeBlock>
      <p>
        Each <code>TranscriptEntry</code> carries the question, the prompt actually asked (follow-up
        or original), the candidate&apos;s answer, and the full <code>EvaluationResult</code> — and
        in Server Mode with <code>signingSecret</code> set, each evaluation also carries an HMAC{' '}
        <code>signature</code> your backend can verify.
      </p>

      <h2>The flow: widget → your API → your database</h2>
      <p>
        Send the report to your own endpoint from <code>onSessionEnd</code>, then store it with
        whatever you already use — Postgres, Prisma, Mongo, Supabase, anything:
      </p>
      <CodeBlock lang="tsx" filename="app/interview/page.tsx (client)">
        {`<InterviewWidget
  questions={questions}
  rubric={rubric}
  mode="server"
  apiBaseUrl="/api/interview/answer"
  onSessionEnd={async (report) => {
    await fetch('/api/interview/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // candidateId comes from your own auth/session — the SDK doesn't
      // know who the candidate is, on purpose.
      body: JSON.stringify({ candidateId, report }),
    });
  }}
/>`}
      </CodeBlock>
      <CodeBlock lang="ts" filename="app/api/interview/complete/route.ts (your backend)">
        {`import { verify } from '@interview-sdk/server';

export async function POST(request: Request) {
  const { candidateId, report } = await request.json();

  // The report was assembled in the candidate's browser — verify each
  // evaluation's HMAC signature against your signing secret before
  // trusting a single number in it (see "Trust, verified" below).
  for (const entry of report.transcript) {
    const { signature, ...evaluation } = entry.evaluation;
    if (!signature || !verify(evaluation, signature, process.env.INTERVIEW_SIGNING_SECRET!)) {
      return Response.json({ error: 'Tampered or unsigned evaluation.' }, { status: 400 });
    }
  }

  // Now persist however you like — this is plain JSON, your schema.
  await db.interviewResult.create({
    data: {
      candidateId,
      sessionId: report.sessionId,
      totalScore: report.totalScore,
      dimensionAverages: report.dimensionAverages,
      missedConcepts: report.missedConcepts,
      transcript: report.transcript,
    },
  });

  return Response.json({ ok: true });
}`}
      </CodeBlock>
      <p>
        That&apos;s the whole loop: the interview runs in your product, scoring happens on your
        backend (<Link href="/production">Server Mode</Link>), and the result lands in your
        database, tied to your own user/candidate record. Build your own admin views, shortlists,
        and analytics on top of your own tables — the SDK never sees any of it.
      </p>

      <h2>Trust, verified</h2>
      <p>
        A browser is not a trusted execution environment — a motivated candidate could edit
        client-side state before <code>onSessionEnd</code> fires. That&apos;s why{' '}
        <code>ServerAnswerProcessor</code> signs every evaluation it returns when you set{' '}
        <code>signingSecret</code>: your backend re-verifies each one (as above) before storing,
        so a tampered score is rejected, not persisted. For the strongest guarantee, recompute{' '}
        <code>totalScore</code> server-side from the verified per-turn evaluations instead of
        trusting the client&apos;s aggregate.
      </p>
      <Callout type="tip">
        Prefer not to trust the client round-trip at all? Persist per-answer instead: your{' '}
        <code>/api/interview/answer</code> route already sees every question, answer, and
        evaluation as they happen — store each turn there (keyed by <code>sessionId</code>), and
        assemble your own report server-side. <code>onSessionEnd</code> then just marks the
        session finished.
      </Callout>

      <h2>Webhooks, if you&apos;d rather push</h2>
      <p>
        Your answer route can also notify another service (an ATS, a Slack bot, a data pipeline)
        with signed, idempotent deliveries — see{' '}
        <Link href="/production">Production Setup&apos;s webhooks section</Link>.
      </p>

      <h2>Exports come free</h2>
      <p>
        Separately from anything you persist, the candidate-facing <code>ReportCard</code> can
        export the same report as JSON or CSV out of the box (PDF too, if you install{' '}
        <code>jspdf</code>) — see{' '}
        <Link href="/styling-and-composition">Styling, composition &amp; accessibility</Link>.
      </p>
    </>
  );
}
