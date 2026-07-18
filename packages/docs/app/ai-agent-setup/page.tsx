import type { Metadata } from 'next';
import Link from 'next/link';
import { Callout } from '../../components/Callout';
import { CodeBlock } from '../../components/CodeBlock';

export const metadata: Metadata = { title: 'Set up with an AI agent' };

const AGENT_PROMPT = `Set up @interview-sdk (an open-source AI-scored-interview SDK, npmjs.com/org/interview-sdk) in this project.

1. Install @interview-sdk/core, @interview-sdk/react, and one AI provider adapter — @interview-sdk/adapter-openai, @interview-sdk/adapter-claude, or @interview-sdk/adapter-gemini. Read each package's own README on npm for its real config shape before writing any code — don't guess constructor options.
2. Decide Client Mode vs. Server Mode: Client Mode (adapter runs in the browser, an env var ships the API key to visitors) is fine for a demo; Server Mode (a real backend route, key never leaves the server) is what a real product ships. Ask me which this is, if it's not obvious from the project.
3. If I want voice, also install @interview-sdk/adapter-deepgram or @interview-sdk/adapter-elevenlabs and read its README for the synthesize/transcribe shape InterviewWidget expects.
4. Optional but recommended: run \`npx @interview-sdk/cli dashboard\` first — it's a local, zero-API-key tool for designing the questions/rubric visually and copying out real integration code.
5. For Server Mode, run \`npx @interview-sdk/cli init --framework nextjs\` (or \`--framework node\`) to scaffold the backend route, then wire in a real adapter where it's marked TODO.
6. Ask me for my actual interview questions and rubric dimensions rather than inventing generic placeholders — and check whether every rubric dimension really applies to every question (a "Systems thinking" dimension has nothing to grade on a plain syntax-recall question) before assuming a single rubric fits all of them. Use Question.dimensions to scope one down if not.
7. Wire up <InterviewWidget> where I actually want it to appear (e.g. inline on a page, or behind a button in a modal) — ask me which, don't assume.
`;

export default function AiAgentSetup() {
  return (
    <>
      <p className="docs-eyebrow">Get started · for AI coding agents</p>
      <h1>Set up with an AI agent</h1>
      <p className="docs-lede">
        If you&apos;d rather have an AI coding agent (Claude Code, Cursor, or similar) wire this up
        for you, hand it the prompt below and let it explore from there — every package publishes
        a real README on npm with its actual API, so an agent that reads before it writes gets a
        correct integration without you having to explain every piece by hand.
      </p>

      <h2>Give your agent this</h2>
      <CodeBlock lang="text" filename="prompt">
        {AGENT_PROMPT}
      </CodeBlock>

      <Callout type="tip">
        The single most common mistake an agent (or a person) makes here is inventing a generic
        rubric and question set instead of asking for the real ones — step 6 above exists
        specifically to head that off. See{' '}
        <Link href="/cookbook/rubric-evaluation">the rubric &amp; evaluation cookbook</Link>{' '}
        for why a rubric dimension that doesn&apos;t apply to a given question needs to say so.
      </Callout>

      <h2>What it&apos;ll find, if it goes looking</h2>
      <ul>
        <li>
          <strong>Every package's README on npm</strong> is the real API reference — constructor
          options, exact exports, usage examples. An agent should read the specific package&apos;s
          README before writing code against it, not guess from a similar library it already knows.
        </li>
        <li>
          <strong><code>npx @interview-sdk/cli dashboard</code></strong> — a local, no-API-key
          tool that generates real, working integration code for whatever questions/rubric/runtime
          mode you configure. Faster and more accurate than hand-writing the first draft.
        </li>
        <li>
          <strong><code>npx @interview-sdk/cli init</code></strong> — scaffolds the Server Mode
          backend route (Next.js or plain Node) with a clearly-marked TODO for the one thing it
          can&apos;t safely guess: which AI provider and API key to use.
        </li>
        <li>
          <strong>This documentation site</strong> — <Link href="/quick-start">Quick Start</Link>{' '}
          and <Link href="/production">Production Setup</Link> are the two paths (prototype vs.
          ship), and everything under <Link href="/cookbook/rubric-evaluation">Guides</Link> covers
          the parts that are easy to get subtly wrong (rubric design, error handling, security).
        </li>
      </ul>

      <h2>Where this fits</h2>
      <p>
        This is an entry point, not a replacement for the rest of these docs — an agent (or you)
        should still land on <Link href="/quick-start">Quick Start</Link> or{' '}
        <Link href="/production">Production Setup</Link> for the actual step-by-step, and{' '}
        <Link href="/dashboard">Local Dashboard</Link> if designing the interview visually first is
        useful.
      </p>
    </>
  );
}
