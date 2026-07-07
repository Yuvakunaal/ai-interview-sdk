import type { Metadata } from 'next';
import Link from 'next/link';
import { Callout } from '../../components/Callout';
import { CodeBlock } from '../../components/CodeBlock';

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
        follow <Link href="/production">Production Setup</Link> instead — the widget code barely changes.
      </p>

      <h2>1. Install</h2>
      <CodeBlock lang="bash" filename="terminal">
        {`npm install @interview-sdk/core @interview-sdk/react @interview-sdk/adapter-openai`}
      </CodeBlock>
      <p>Swap the adapter package for whichever provider you use — see the provider guides.</p>

      <h2>2. Add an API key</h2>
      <CodeBlock lang="bash" filename=".env.local">
        {`# .env.local — Client Mode only, never do this in production
NEXT_PUBLIC_OPENAI_API_KEY=sk-...`}
      </CodeBlock>
      <p>
        The <code>NEXT_PUBLIC_</code> (or Vite&apos;s <code>VITE_</code>) prefix is what actually
        exposes it to the browser — that&apos;s the whole risk in one line.
      </p>

      <h2>3. Define questions + rubric</h2>
      <CodeBlock lang="ts" filename="lib/questions.ts">
        {`import type { Question, RubricDimensionInput } from '@interview-sdk/core';

const questions: Question[] = [
  { id: 'q1', prompt: 'Explain how hash maps handle collisions.', concepts: ['hashing', 'collisions'] },
];

const rubric: RubricDimensionInput[] = [
  { id: 'technical', label: 'Technical depth', weight: 3 },
  { id: 'communication', label: 'Communication clarity', weight: 1 },
];`}
      </CodeBlock>

      <h2>4. Drop in InterviewWidget</h2>
      <CodeBlock lang="tsx" filename="App.tsx">
        {`import '@interview-sdk/react/styles.css';
import { InterviewWidget } from '@interview-sdk/react';
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
}`}
      </CodeBlock>

      <h2>5. Run the project</h2>
      <CodeBlock lang="bash" filename="terminal">
        {`npm run dev`}
      </CodeBlock>
      <p>
        That&apos;s a full interview: dynamic follow-ups, semantic evaluation, rubric scoring, and a
        report — with voice input if you also register a{' '}
        <Link href="/integrations/providers">voice provider adapter</Link> and pass its{' '}
        <code>transcribe</code> function to <code>InterviewWidget</code>.
      </p>

      <Callout type="warning">
        Client Mode refuses to render when <code>NODE_ENV=production</code> unless you pass{' '}
        <code>allowClientModeInProduction</code> explicitly — it&apos;s not a soft warning,
        it&apos;s a hard stop, on purpose.
      </Callout>

      <h2>Next: ship it for real</h2>
      <p>
        <Link href="/production">Production Setup (Server Mode)</Link> walks through the same five steps
        with your key and scoring logic moved server-side.
      </p>
    </>
  );
}
