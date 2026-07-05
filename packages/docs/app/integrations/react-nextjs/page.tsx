import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'React + Next.js integration' };

export default function ReactNextjs() {
  return (
    <>
      <h1>React + Next.js integration</h1>
      <p className="docs-lede">
        <code>@interview-sdk/react</code> is a plain React component library — no framework lock-in.
        This page covers the parts specific to Next.js: client/server component boundaries, and
        wiring the Server Mode route in the App Router.
      </p>

      <h2>Client component boundary</h2>
      <p>
        <code>InterviewWidget</code> (and every component in the package) uses hooks and browser
        APIs, so any file that renders it in the App Router needs{' '}
        <code>&apos;use client&apos;</code>
        at the top:
      </p>
      <pre>
        <code>{`'use client';

import { InterviewWidget } from '@interview-sdk/react';

export default function InterviewPage() {
  return <InterviewWidget questions={questions} rubric={rubric} mode="server" apiBaseUrl="/api/interview/answer" />;
}`}</code>
      </pre>
      <p>
        Keep the questions/rubric data itself in a plain <code>.ts</code> module you import from
        both the client page and the server route — that&apos;s a Server Component by default and
        never ships to the browser bundle unless a client component imports it too, which is exactly
        what happens here (harmless: it&apos;s just data, not a secret).
      </p>

      <h2>The Server Mode API route</h2>
      <pre>
        <code>{`// app/api/interview/answer/route.ts
import { ServerAnswerProcessor, createInterviewAnswerHandler } from '@interview-sdk/server';
import { OpenAIAdapter } from '@interview-sdk/adapter-openai';
import { questions, rubric } from '../../../../lib/questions';

const processor = new ServerAnswerProcessor({
  questions,
  rubric,
  adapter: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
});

export const POST = createInterviewAnswerHandler(processor);`}</code>
      </pre>
      <p>
        This constructs <code>processor</code> once at module scope and reuses it across requests —
        the standard pattern for Route Handlers, and how{' '}
        <code>packages/examples/server-mode-nextjs</code> in the SDK repo is built (a full, runnable
        copy of this pattern with <code>pnpm dev</code>).
      </p>

      <h2>Voice input</h2>
      <p>
        Pass a <code>transcribe</code> prop (typically a <code>VoiceProviderAdapter</code>&apos;s{' '}
        <code>transcribe()</code>) to enable the mic button. In Server Mode, run the voice provider
        adapter server-side too — proxy it through its own API route, the same way the
        answer-scoring route works, so that key stays off the client as well.
      </p>

      <h2>Non-Next.js frameworks</h2>
      <p>
        Everything above works the same in Vite/CRA/Remix for the client side — only the Server Mode
        route&apos;s file location and export syntax change.{' '}
        <code>createInterviewAnswerHandler</code> returns a Fetch API{' '}
        <code>(Request) =&gt; Promise&lt;Response&gt;</code>, so it drops into Remix loaders,
        Cloudflare Workers, Deno, Bun, or Hono directly; for plain Node <code>http</code> or
        Express, see the small adapter snippet in the <code>@interview-sdk/server</code> README.
      </p>
    </>
  );
}
