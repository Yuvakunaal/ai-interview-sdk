import type { Metadata } from 'next';
import Link from 'next/link';
import { Callout } from '../../components/Callout';
import { CodeBlock } from '../../components/CodeBlock';

export const metadata: Metadata = { title: 'Production Setup (Server Mode)' };

export default function Production() {
  return (
    <>
      <p className="docs-eyebrow">Server Mode · production</p>
      <h1>Production Setup</h1>
      <p className="docs-lede">
        This is what you ship. Every answer is scored by <code>@interview-sdk/server</code> on{' '}
        <em>your</em> backend — the AI provider key never reaches the browser, and the client never
        has write access to the score object.
      </p>

      <h2>1. Install</h2>
      <CodeBlock lang="bash" filename="terminal">
        {`npm install @interview-sdk/core @interview-sdk/react @interview-sdk/server @interview-sdk/adapter-openai`}
      </CodeBlock>

      <h2>2. Add an API key — server-side only</h2>
      <CodeBlock lang="bash" filename=".env">
        {`# .env — no NEXT_PUBLIC_ / VITE_ prefix, this stays on the server
OPENAI_API_KEY=sk-...
INTERVIEW_SIGNING_SECRET=a-long-random-string`}
      </CodeBlock>

      <h2>3. Define questions + rubric once, shared by both sides</h2>
      <p>
        Put them in their own module so the route and the widget import the exact same array —
        no risk of the two copies drifting apart:
      </p>
      <CodeBlock lang="ts" filename="lib/questions.ts">
        {`export const questions = [
  { id: 'q1', prompt: 'Explain how hash maps handle collisions.', concepts: ['hashing', 'collisions'] },
];
export const rubric = [{ id: 'technical', label: 'Technical depth', weight: 1 }];`}
      </CodeBlock>
      <p>
        This module-level copy is what the <em>client</em> renders (the prompt text, the rubric
        labels on the report) — <code>ServerAnswerProcessor</code> below gets its own copy too,
        but only ever trusts <em>that</em> copy: it uses just{' '}
        <code>answer.questionId</code> from each request to look a question up, so a tampered
        request that includes a different prompt or rubric is ignored, not trusted. The two copies
        being identical is what keeps the UI honest about what&apos;s actually being scored — it
        isn&apos;t a security boundary by itself.
      </p>
      <CodeBlock lang="ts" filename="app/api/interview/answer/route.ts">
        {`import { ServerAnswerProcessor, createInterviewAnswerHandler } from '@interview-sdk/server';
import { OpenAIAdapter } from '@interview-sdk/adapter-openai';
import { questions, rubric } from '../../../../lib/questions';

const processor = new ServerAnswerProcessor({
  questions,
  rubric,
  adapter: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
  signingSecret: process.env.INTERVIEW_SIGNING_SECRET,
});

export const POST = createInterviewAnswerHandler(processor);`}
      </CodeBlock>
      <p>
        <code>createInterviewAnswerHandler</code> returns a standard Fetch API{' '}
        <code>(Request) =&gt; Promise&lt;Response&gt;</code>, so it works as-is in any router that
        speaks that signature — Next.js, Deno, Bun, Cloudflare Workers, Hono. For plain Node{' '}
        <code>http</code> or Express, wrap it — see the{' '}
        <Link href="/integrations/react-nextjs">React + Next.js guide</Link> for the adapter snippet.
      </p>

      <h2>4. The widget (client-side)</h2>
      <CodeBlock lang="tsx" filename="app/interview/page.tsx">
        {`'use client';
import '@interview-sdk/react/styles.css';
import { InterviewWidget } from '@interview-sdk/react';
import { questions, rubric } from '../lib/questions';

export default function Page() {
  return (
    <InterviewWidget
      questions={questions}
      rubric={rubric}
      mode="server"
      apiBaseUrl="/api/interview/answer"
    />
  );
}`}
      </CodeBlock>
      <p>
        The only difference from the Quick Start&apos;s Client Mode widget is{' '}
        <code>mode=&quot;server&quot;</code> plus <code>apiBaseUrl</code> instead of{' '}
        <code>adapter</code>.
      </p>

      <h2>5. Run the project</h2>
      <CodeBlock lang="bash" filename="terminal">
        {`npm run dev`}
      </CodeBlock>

      <h2>Or scaffold this automatically</h2>
      <CodeBlock lang="bash" filename="terminal">
        {`npx interview-sdk init --framework nextjs
# or: npx interview-sdk init --framework node --dir ./my-app --force`}
      </CodeBlock>
      <p>
        Writes the route handler above with a clearly-marked placeholder adapter (
        <code>app/api/interview/answer/route.ts</code> for Next.js,{' '}
        <code>interview-server.mjs</code> for a standalone Node server), plus a{' '}
        <code>.env.example</code> listing the env vars the route reads. Refuses to overwrite either
        existing file unless you pass <code>--force</code>; <code>--dir</code> scaffolds into a
        directory other than the current one. For Next.js, if <code>app/layout.tsx</code> already
        exists, <code>init</code> also inserts the{' '}
        <code>import &apos;@interview-sdk/react/styles.css&apos;;</code> the widget needs and is
        easy to forget — the widget otherwise renders completely unstyled with no error. See the{' '}
        <Link href="/trust-tooling">CLI walkthrough</Link>. A fully working, runnable version of
        this exact setup (with a mock adapter, so it runs with zero API key) lives in{' '}
        <code>packages/examples/server-mode-nextjs</code> in the SDK repo.
      </p>

      <h2>Score integrity, concretely</h2>
      <ul>
        <li>
          The client only ever renders UI and streams audio/text — it never computes or holds a
          writable score.
        </li>
        <li>
          Pass <code>signingSecret</code> to have every evaluation HMAC-signed, so you can verify a
          client-reconstructed report wasn&apos;t altered in the browser before trusting it.
        </li>
        <li>
          Session-tracking fields (<code>previousTurns</code>, <code>currentFollowUpDepth</code>)
          are trusted as sent by default — verify them against your own persisted session state if
          you need stronger guarantees (this package holds no session store of its own, by the
          Zero-Infra Guarantee).
        </li>
      </ul>
      <p>
        Re-verify a signature with <code>verify()</code> before trusting a stored or
        client-reconstructed evaluation — never trust whatever aggregate the client sends back:
      </p>
      <CodeBlock lang="ts">
        {`import { verify } from '@interview-sdk/server';

const { signature, ...evaluation } = signedEvaluation;
const isAuthentic = verify(evaluation, signature, process.env.INTERVIEW_SIGNING_SECRET!);`}
      </CodeBlock>
      <Callout type="warning">
        <code>createInterviewAnswerHandler</code> has no built-in authentication or
        rate-limiting — it processes any request that reaches it, and every request is a real,
        billed call to your AI provider. An unauthenticated, unthrottled route is a direct
        cost-based denial-of-service vector, not just a data-integrity concern. Put it behind your
        own auth middleware and a rate limiter (per-session or per-IP) before exposing it publicly;
        this package intentionally holds no auth/session store of its own (Zero-Infra Guarantee).
      </Callout>

      <h2>Webhooks</h2>
      <p>
        Notify your own backend when a session ends, without polling — deliveries are HMAC-signed
        (Stripe/GitHub-style: <code>t=&lt;timestamp&gt;,v1=&lt;signature&gt;</code>) and carry an
        idempotency key so your receiver can dedupe retries:
      </p>
      <CodeBlock lang="ts">
        {`import { WebhookDispatcher } from '@interview-sdk/server';

const dispatcher = new WebhookDispatcher({
  url: 'https://your-app.example.com/webhooks/interview',
  secret: process.env.WEBHOOK_SECRET!,
});

await dispatcher.send('sessionEnd', { sessionId, totalScore });`}
      </CodeBlock>
      <p>
        Verify inbound deliveries with <code>verifyWebhookSignature(rawBody, header, secret)</code>{' '}
        — it also rejects payloads older than a tolerance window (5 minutes by default) to bound
        replay exposure.
      </p>
      <Callout type="note">
        <code>WebhookDispatcher</code> retries with exponential backoff (5 attempts by default) but
        keeps no state across process restarts — per the Zero-Infra Guarantee, this package holds
        no database of its own. If delivery must survive a restart, call{' '}
        <code>dispatcher.send()</code> from your own durable job queue rather than relying on its
        in-memory retry loop alone.
      </Callout>

      <p>
        See <Link href="/security">Security &amp; compliance</Link> for the full picture, and{' '}
        <Link href="/error-handling">Error handling &amp; resilience</Link> for the full provider
        error taxonomy.
      </p>
    </>
  );
}
