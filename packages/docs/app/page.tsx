import Link from 'next/link';
import { Callout } from '../components/Callout';
import { CodeBlock } from '../components/CodeBlock';

export default function Home() {
  return (
    <>
      <p className="docs-eyebrow">Open source · self-hosted · MIT licensed</p>
      <h1>AI Interview SDK</h1>
      <p className="docs-lede">
        Infrastructure for embedding AI-scored interviews into your own product — your API keys,
        your backend, your database. The maintainers never see, store, or process a candidate&apos;s
        data.
      </p>

      <CodeBlock lang="bash" filename="terminal">
        {`npm install @interview-sdk/core @interview-sdk/react`}
      </CodeBlock>

      <h2>Your path, start to finish</h2>
      <p>
        This is the whole journey — each step is one page, and each page ends where the next one
        starts:
      </p>
      <ol>
        <li>
          <strong>
            <Link href="/dashboard">Design it — Local Dashboard</Link>
          </strong>{' '}
          — run <code>npx interview-sdk dashboard</code>, shape your questions, rubric, and
          interview style in a live preview, and copy the exact integration code. No API key
          needed.
        </li>
        <li>
          <strong>
            <Link href="/quick-start">Try it — Quick Start (Client Mode)</Link>
          </strong>{' '}
          — paste that code into your app, add one AI provider key, and run a full interview
          locally in about five minutes. Prototyping only.
        </li>
        <li>
          <strong>
            <Link href="/production">Ship it — Production Setup (Server Mode)</Link>
          </strong>{' '}
          — move the key and scoring to your own backend route. The widget code barely changes;
          the security model changes completely.
        </li>
        <li>
          <strong>
            <Link href="/saving-results">Keep it — Saving results</Link>
          </strong>{' '}
          — store every finished interview&apos;s report in your own database, tied to your own
          users, with tamper-proof HMAC verification.
        </li>
        <li>
          <strong>
            <Link href="/trust-tooling">Prove it — Simulator &amp; Bias Harness</Link>
          </strong>{' '}
          — before real candidates, run scripted personas and labeled samples against your rubric
          to catch unfairness and inconsistency in CI.
        </li>
      </ol>
      <Callout type="tip">
        In a hurry? Steps 1–2 get you a working interview today. Steps 3–5 are what make it
        production-grade — do them before a real candidate ever sees it.
      </Callout>

      <h2>Going deeper</h2>
      <ul>
        <li>
          <Link href="/integrations/react-nextjs">React + Next.js integration</Link> —
          client/server component boundaries and the App Router route pattern.
        </li>
        <li>
          <Link href="/integrations/providers">AI &amp; voice provider guides</Link> — OpenAI,
          Claude, Gemini, Deepgram, ElevenLabs, plus failover.
        </li>
        <li>
          <Link href="/cookbook/rubric-evaluation">Rubric &amp; evaluation cookbook</Link> — how
          scoring, concept coverage, and follow-ups actually behave.
        </li>
        <li>
          <Link href="/styling-and-composition">Styling, composition &amp; accessibility</Link> —
          theming, headless mode, and building your own UI on the same pieces.
        </li>
        <li>
          <Link href="/error-handling">Error handling &amp; resilience</Link> — the full provider
          error taxonomy, hard limits, and retries.
        </li>
        <li>
          <Link href="/session-persistence-and-events">Session persistence &amp; events</Link> —
          resuming after a refresh, and the typed event emitter.
        </li>
        <li>
          <Link href="/coding-interviews">Coding Interview Mode</Link> — sandboxed code execution
          and weighted test-case scoring.
        </li>
        <li>
          <Link href="/security">Security &amp; compliance checklist</Link> — what the
          architecture guarantees, and what stays your responsibility.
        </li>
      </ul>

      <h2>Setup walkthrough video</h2>
      <p>
        <em>
          Coming soon — the primary onboarding path is a short install-to-running-widget video,
          embedded here once recorded. The written path above covers the same steps in the
          meantime.
        </em>
      </p>
    </>
  );
}
