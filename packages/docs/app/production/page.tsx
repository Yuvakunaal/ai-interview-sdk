import type { Metadata } from 'next';

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
      <pre>
        <code>
          npm install @interview-sdk/core @interview-sdk/react @interview-sdk/server
          @interview-sdk/adapter-openai
        </code>
      </pre>

      <h2>2. Add an API key — server-side only</h2>
      <pre>
        <code>{`# .env — no NEXT_PUBLIC_ / VITE_ prefix, this stays on the server
OPENAI_API_KEY=sk-...
INTERVIEW_SIGNING_SECRET=a-long-random-string`}</code>
      </pre>

      <h2>3. Define questions + rubric (server-side)</h2>
      <p>
        This is your canonical config — <code>ServerAnswerProcessor</code> uses only{' '}
        <code>answer.questionId</code> from each request to look one up. A tampered request that
        includes a different question or rubric is ignored, not trusted.
      </p>
      <pre>
        <code>{`import { ServerAnswerProcessor, createInterviewAnswerHandler } from '@interview-sdk/server';
import { OpenAIAdapter } from '@interview-sdk/adapter-openai';

const processor = new ServerAnswerProcessor({
  questions: [
    { id: 'q1', prompt: 'Explain how hash maps handle collisions.', concepts: ['hashing', 'collisions'] },
  ],
  rubric: [{ id: 'technical', label: 'Technical depth', weight: 1 }],
  adapter: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
  signingSecret: process.env.INTERVIEW_SIGNING_SECRET,
});`}</code>
      </pre>

      <h3>4a. The API route (Next.js Route Handler)</h3>
      <pre>
        <code>{`// app/api/interview/answer/route.ts
export const POST = createInterviewAnswerHandler(processor);`}</code>
      </pre>
      <p>
        <code>createInterviewAnswerHandler</code> returns a standard Fetch API{' '}
        <code>(Request) =&gt; Promise&lt;Response&gt;</code>, so it works as-is in any router that
        speaks that signature — Next.js, Deno, Bun, Cloudflare Workers, Hono. For plain Node
        <code>http</code> or Express, wrap it — see the{' '}
        <a href="/integrations/react-nextjs">React + Next.js guide</a> for the adapter snippet.
      </p>

      <h3>4b. The widget (client-side)</h3>
      <pre>
        <code>{`'use client';
import { InterviewWidget } from '@interview-sdk/react';

export default function Page() {
  return (
    <InterviewWidget
      questions={questions}
      rubric={rubric}
      mode="server"
      apiBaseUrl="/api/interview/answer"
    />
  );
}`}</code>
      </pre>
      <p>
        The only difference from the Quick Start&apos;s Client Mode widget is{' '}
        <code>mode=&quot;server&quot;</code> plus <code>apiBaseUrl</code> instead of{' '}
        <code>adapter</code>.
      </p>

      <h2>5. Run the project</h2>
      <pre>
        <code>npm run dev</code>
      </pre>

      <h2>Or scaffold this automatically</h2>
      <pre>
        <code>npx interview-sdk init --framework nextjs</code>
      </pre>
      <p>
        Writes the route handler above with a clearly-marked placeholder adapter — see the{' '}
        <a href="/trust-tooling">CLI walkthrough</a>. A fully working, runnable version of this
        exact setup (with a mock adapter, so it runs with zero API key) lives in{' '}
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
        See <a href="/security">Security &amp; compliance</a> for the full picture.
      </p>
    </>
  );
}
