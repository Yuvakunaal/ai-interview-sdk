import type { Metadata } from 'next';
import Link from 'next/link';
import { Callout } from '../../components/Callout';
import { CodeBlock } from '../../components/CodeBlock';

export const metadata: Metadata = { title: 'Set up with an AI agent' };

const AGENT_PROMPT = `Set up @interview-sdk (an open-source AI-scored-interview SDK, npmjs.com/org/interview-sdk) in this project.

1. Install @interview-sdk/core, @interview-sdk/react, and one AI provider adapter — @interview-sdk/adapter-openai, @interview-sdk/adapter-claude, or @interview-sdk/adapter-gemini. Read each package's own README on npm for its real config shape before writing any code — don't guess constructor options. If I want a provider without a dedicated adapter (e.g. Groq, or any other OpenAI-compatible endpoint), don't treat that as unsupported — @interview-sdk/adapter-openai accepts a pre-configured \`client\` option, so it works with any OpenAI-compatible API by pointing that client's baseURL elsewhere. Confirm the target endpoint actually supports the same API shape the adapter calls before wiring it in.
2. Decide Client Mode vs. Server Mode: Client Mode (adapter runs in the browser, an env var ships the API key to visitors) is fine for a demo; Server Mode (a real backend route, key never leaves the server) is what a real product ships. Ask me which this is, if it's not obvious from the project. If Server Mode: also generate an \`INTERVIEW_SIGNING_SECRET\` and pass it to \`ServerAnswerProcessor\` as \`signingSecret\` — this is what lets every evaluation be HMAC-signed and later re-verified, so a persisted/displayed report can be proven untampered. Skipping it silently gives up that guarantee.
3. Whichever adapter(s) you install, check whether its constructor throws synchronously when no API key is configured (most do; not all — verify each one directly rather than assuming). If it does, don't construct it at module load time — a missing key would crash the entire server, not just the interview routes. Build it lazily inside the route handler, wrapped in try/catch, so a missing key only 502s/503s the interview endpoints with a message naming the exact env var to set.
4. If I want voice, also install @interview-sdk/adapter-deepgram or @interview-sdk/adapter-elevenlabs and read its README for the synthesize/transcribe shape InterviewWidget expects. If we're in Server Mode: know that the SDK's actual behavior wires \`transcribe\`/\`synthesize\` directly from the browser to the provider regardless of mode — only answer-scoring has a documented server-side path out of the box. If keeping the voice key off the client actually matters here, build two extra proxy routes yourself (mirroring the same Express/Next.js shim pattern the @interview-sdk/server README shows for the answer route) rather than assuming Server Mode already covers this.
5. Optional but recommended: run \`npx @interview-sdk/cli dashboard\` first — it's a local, zero-API-key tool for designing the questions/rubric visually and copying out real integration code.
6. For Server Mode, run \`npx @interview-sdk/cli init --framework nextjs\` (or \`--framework node\`) to scaffold the backend route, then wire in a real adapter where it's marked TODO.
7. Ask me for my actual interview questions and rubric dimensions rather than inventing generic placeholders — and check whether every rubric dimension really applies to every question (a "Systems thinking" dimension has nothing to grade on a plain syntax-recall question) before assuming a single rubric fits all of them. Use Question.dimensions to scope one down if not.
8. Wire up <InterviewWidget> where I actually want it to appear (e.g. inline on a page, or behind a button in a modal) — ask me which, don't assume. Two things to check empirically, not just by reading docs:
   - The widget's own shipped CSS defaults its root to \`height: 100vh\`/\`100dvh\` — it assumes it owns the full viewport. If it's going anywhere other than a dedicated full-page route, pass the \`style\` prop (e.g. \`style={{ height: '100%' }}\`) so it fills its actual container instead of overflowing/clipping.
   - If placing it inline in an existing narrow container (a sidebar, a panel), actually check the container's width — it's a two-pane UI and doesn't degrade gracefully below some width; a column sized for something else can produce broken text wrapping rather than a sensible responsive collapse.
   - If building a fullscreen-takeover flow instead, and requesting the real browser Fullscreen API as part of it: call \`requestFullscreen()\` synchronously, before any \`await\`, in the original click handler — browsers silently drop the request once a gesture-triggered handler has yielded to an async gap.
9. Decide what happens to the finished report. \`onSessionEnd(report)\` fires once and the SDK's job ends there — it does not persist anything (no database of its own, by design). If this needs to outlive the browser tab, wire \`onSessionEnd\` to your own backend now, not as an afterthought later.
10. Before treating this as production-ready, close two gaps the SDK's own docs explicitly flag as not built-in: add auth and rate-limiting in front of the answer-scoring route (an unauthenticated, unthrottled route is a direct cost-based denial-of-service vector — every request is a real, billed AI call), and if \`previousTurns\`/follow-up depth matter for scoring integrity, verify them against your own persisted session state rather than trusting whatever the client sends.
11. Before trusting this with real candidates, run \`npx @interview-sdk/cli simulate --config <your config>\` (scripted strong/weak/off-topic/silent/adversarial personas through your real question bank — flags a too-harsh or too-lenient rubric, or a provider that follows instructions embedded in an answer instead of grading it) and \`npx @interview-sdk/cli bias-harness\` (checks scoring consistency across repeated runs on labeled samples) against your actual rubric, not a toy one.
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
        rubric and question set instead of asking for the real ones — step 7 above exists
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
          <strong><code>npx @interview-sdk/cli simulate</code></strong> and{' '}
          <strong><code>npx @interview-sdk/cli bias-harness</code></strong> — run scripted
          personas and labeled samples through your actual question bank and rubric before a real
          candidate ever sees it, catching a too-harsh/too-lenient rubric, a provider that follows
          instructions embedded in an answer instead of grading it, or inconsistent scoring across
          repeated runs. See{' '}
          <Link href="/trust-tooling">the Simulator &amp; Bias Harness walkthrough</Link>.
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
