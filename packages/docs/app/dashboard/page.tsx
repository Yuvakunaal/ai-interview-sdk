import type { Metadata } from 'next';
import Link from 'next/link';
import { Callout } from '../../components/Callout';
import { CodeBlock } from '../../components/CodeBlock';

export const metadata: Metadata = { title: 'Local Dashboard' };

export default function Dashboard() {
  return (
    <>
      <p className="docs-eyebrow">@interview-sdk/cli · design &amp; preview</p>
      <h1>Local Dashboard</h1>
      <p className="docs-lede">
        A browser tool, running entirely on your own machine, for designing an interview and
        getting real integration code out of it — before you touch a text editor. No API key, no
        account, nothing leaves your machine.
      </p>

      <h2>Run it</h2>
      <CodeBlock lang="bash" filename="terminal">
        {`npm install --save-dev @interview-sdk/cli
npx interview-sdk dashboard`}
      </CodeBlock>
      <p>
        Starts a local server and opens it in your default browser automatically — printing the
        URL either way, in case the auto-open doesn&apos;t work in your environment:
      </p>
      <CodeBlock lang="bash" filename="terminal output">
        {`Dashboard running at http://localhost:4949/
Press Ctrl+C to stop.`}
      </CodeBlock>
      <p>
        Binds to <code>localhost</code> only, never your network. If port 4949 is taken it
        retries the next one automatically. Override either with flags:
      </p>
      <CodeBlock lang="bash" filename="terminal">
        {`npx interview-sdk dashboard --port 5050 --host 127.0.0.1`}
      </CodeBlock>

      <h2>What you&apos;re configuring</h2>
      <p>The left panel is the actual shape of the interview you&apos;ll ship:</p>
      <ul>
        <li>
          <strong>Runtime mode</strong> — Voice first, Hybrid (audio + typed fallback), or Typed
          only.
        </li>
        <li>
          <strong>Role preset</strong> (or a custom role) and <strong>difficulty</strong> — Junior,
          Mid, or Senior.
        </li>
        <li>
          <strong>Timebox</strong> — a 5–45 minute session length.
        </li>
        <li>
          <strong>Follow-ups</strong> — on or off.
        </li>
        <li>
          <strong>Brand color</strong> — carried straight into the generated widget.
        </li>
        <li>
          <strong>Question editor</strong> — add, remove, and edit each question&apos;s prompt and
          concept list directly.
        </li>
      </ul>

      <h2>Preview, then Code</h2>
      <p>
        The right side is a segmented <strong>Preview / Code</strong> view of whatever you&apos;ve
        configured on the left:
      </p>
      <ul>
        <li>
          <strong>Preview</strong> runs a real <code>&lt;InterviewWidget&gt;</code> against a local
          mock adapter — click through a full interview, follow-ups included, with zero API keys.
        </li>
        <li>
          <strong>Code</strong> generates the exact <code>&lt;InterviewWidget&gt;</code> integration
          for your current configuration, with a copy button.
        </li>
      </ul>
      <CodeBlock lang="tsx" filename="generated — Code tab">
        {`import { InterviewWidget } from '@interview-sdk/react';
import '@interview-sdk/react/styles.css';

const questions = [
  { id: 'q1', prompt: 'How does a hash map resolve collisions in a production system?', concepts: ['hashing', 'collision resolution'] },
];

const rubric = [{ id: 'technical', label: 'Technical accuracy', weight: 3 }];

export function CandidateInterview() {
  return (
    <InterviewWidget
      mode="server"
      apiBaseUrl="/api/interview/answer"
      questions={questions}
      rubric={rubric}
      maxFollowUpDepth={1}
      sessionTimeoutMs={1080000}
      roleTitle="Senior Frontend Engineer"
      synthesize={voiceProvider.synthesize.bind(voiceProvider)}
      transcribe={async (audio) => (await voiceProvider.transcribe(await audio.arrayBuffer())).text}
    />
  );
}`}
      </CodeBlock>

      <Callout type="note">
        The generated code is always <strong>Server Mode</strong> — the secure default — even
        though the dashboard&apos;s own live preview runs Client Mode against the mock adapter so it
        can work with no key at all. Wire it up for real by following{' '}
        <Link href="/production">Production Setup</Link> for the <code>/api/interview/answer</code>{' '}
        route, or swap <code>voiceProvider</code> for one of the{' '}
        <Link href="/integrations/providers">voice adapters</Link> if you enabled voice.
      </Callout>

      <h2>Where this fits</h2>
      <p>
        Run this <em>before</em> <Link href="/quick-start">Quick Start</Link> — design the
        question set and interview shape here, copy the code it gives you, then drop it into your
        app and follow Quick Start or Production Setup to connect a real AI provider.
      </p>
    </>
  );
}
