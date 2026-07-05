import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Quick Start (Client Mode)' };

export default function QuickStart() {
  return (
    <>
      <p className="docs-eyebrow">Client Mode · prototyping</p>
      <h1>Quick Start</h1>
      <p className="docs-lede">
        The fastest path to a running interview — no backend required. Client Mode calls your AI
        provider directly from the browser, which is exactly why it&apos;s{' '}
        <strong>prototyping-only</strong>: your API key ships to every visitor&apos;s browser, and
        nothing stops a candidate from tampering with the score client-side. For anything real,
        follow <a href="/production">Production Setup</a> instead — the widget code barely changes.
      </p>

      <h2>1. Install</h2>
      <pre>
        <code>
          npm install @interview-sdk/core @interview-sdk/react @interview-sdk/adapter-openai
        </code>
      </pre>
      <p>Swap the adapter package for whichever provider you use — see the provider guides.</p>

      <h2>2. Add an API key</h2>
      <pre>
        <code>{`# .env.local — Client Mode only, never do this in production
NEXT_PUBLIC_OPENAI_API_KEY=sk-...`}</code>
      </pre>
      <p>
        The <code>NEXT_PUBLIC_</code> (or Vite&apos;s <code>VITE_</code>) prefix is what actually
        exposes it to the browser — that&apos;s the whole risk in one line.
      </p>

      <h2>3. Define questions + rubric</h2>
      <pre>
        <code>{`import type { Question, RubricDimensionInput } from '@interview-sdk/core';

const questions: Question[] = [
  { id: 'q1', prompt: 'Explain how hash maps handle collisions.', concepts: ['hashing', 'collisions'] },
];

const rubric: RubricDimensionInput[] = [
  { id: 'technical', label: 'Technical depth', weight: 3 },
  { id: 'communication', label: 'Communication clarity', weight: 1 },
];`}</code>
      </pre>

      <h2>4. Drop in InterviewWidget</h2>
      <pre>
        <code>{`import { InterviewWidget } from '@interview-sdk/react';
import { OpenAIAdapter } from '@interview-sdk/adapter-openai';

const adapter = new OpenAIAdapter({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY });

export default function App() {
  return (
    <InterviewWidget
      questions={questions}
      rubric={rubric}
      mode="client"
      adapter={adapter}
      onSessionEnd={(report) => console.log(report)}
    />
  );
}`}</code>
      </pre>

      <h2>5. Run the project</h2>
      <pre>
        <code>npm run dev</code>
      </pre>
      <p>
        That&apos;s a full interview: dynamic follow-ups, semantic evaluation, rubric scoring, and a
        report — with voice input if you also register a{' '}
        <a href="/integrations/providers">voice provider adapter</a> and pass its{' '}
        <code>transcribe</code> function to <code>InterviewWidget</code>.
      </p>

      <blockquote>
        Client Mode refuses to render when <code>NODE_ENV=production</code> unless you pass{' '}
        <code>allowClientModeInProduction</code> explicitly — it&apos;s not a soft warning,
        it&apos;s a hard stop, on purpose.
      </blockquote>

      <h2>Next: ship it for real</h2>
      <p>
        <a href="/production">Production Setup (Server Mode)</a> walks through the same five steps
        with your key and scoring logic moved server-side.
      </p>
    </>
  );
}
