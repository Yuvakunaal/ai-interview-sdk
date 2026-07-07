import Link from 'next/link';
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

      <h2>Setup walkthrough video</h2>
      <p>
        <em>
          Coming soon — the primary onboarding path is a short install-to-running-widget video,
          embedded here once recorded. Follow the written Quick Start below in the meantime; it
          covers the same steps.
        </em>
      </p>

      <h2>Where to go next</h2>
      <ul>
        <li>
          <Link href="/dashboard">Local Dashboard</Link> — design your interview and get real
          integration code in a browser, before you open an editor. Start here.
        </li>
        <li>
          <Link href="/quick-start">Quick Start (Client Mode)</Link> — fastest path to a running
          demo, no backend required.
        </li>
        <li>
          <Link href="/production">Production Setup (Server Mode)</Link> — what you actually ship.
          Equally prominent here, not an afterthought.
        </li>
        <li>
          <Link href="/integrations/react-nextjs">React + Next.js integration</Link>
        </li>
        <li>
          <Link href="/integrations/providers">AI &amp; voice provider guides</Link> — OpenAI,
          Claude, Gemini, Deepgram, ElevenLabs.
        </li>
        <li>
          <Link href="/cookbook/rubric-evaluation">Rubric &amp; evaluation cookbook</Link>
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
          <Link href="/session-persistence-and-events">Session persistence &amp; events</Link>
        </li>
        <li>
          <Link href="/security">Security &amp; compliance checklist</Link>
        </li>
        <li>
          <Link href="/trust-tooling">Interview Simulator &amp; Bias Harness walkthrough</Link>
        </li>
      </ul>

      <h2>What &quot;working&quot; means</h2>
      <p>By the end of the Quick Start, you should be able to:</p>
      <ol>
        <li>Install the package</li>
        <li>Add an API key</li>
        <li>Define questions + rubric</li>
        <li>
          Drop in <code>&lt;InterviewWidget /&gt;</code>
        </li>
        <li>Run the project</li>
      </ol>
      <p className="docs-lede">
        …and get a working AI interview — with dynamic follow-ups, semantic evaluation, rubric
        scoring, voice, and reports — with a clear, well-documented path to a secure,
        production-ready Server Mode setup.
      </p>
    </>
  );
}
