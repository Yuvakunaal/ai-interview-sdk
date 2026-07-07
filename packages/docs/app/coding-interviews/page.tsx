import type { Metadata } from 'next';
import { Callout } from '../../components/Callout';
import { CodeBlock } from '../../components/CodeBlock';

export const metadata: Metadata = { title: 'Coding Interview Mode' };

export default function CodingInterviews() {
  return (
    <>
      <h1>Coding Interview Mode</h1>
      <p className="docs-lede">
        <code>@interview-sdk/coding</code> is a standalone, headless scoring engine for coding
        questions: sandboxed execution, weighted test-case scoring, and honesty-labeled heuristics.
        It does <em>not</em> plug into <code>&lt;InterviewWidget&gt;</code> or{' '}
        <code>ServerAnswerProcessor</code> today — there&apos;s no code editor UI or coding-specific
        question type in <code>@interview-sdk/core</code> yet. Bring your own code editor (Monaco,
        CodeMirror), call this engine from your own API route, and render its result however you
        like.
      </p>

      <h2>Install</h2>
      <CodeBlock lang="bash" filename="terminal">
        {`npm install @interview-sdk/coding`}
      </CodeBlock>
      <p>Requires Docker on whatever machine runs it — your backend or CI, never the browser.</p>

      <h2>A minimal route</h2>
      <CodeBlock lang="ts" filename="app/api/coding/submit/route.ts">
        {`import { CodingEvaluationEngine, DockerCodeExecutionProvider } from '@interview-sdk/coding';
import type { CodingQuestion } from '@interview-sdk/coding';

const question: CodingQuestion = {
  id: 'q1',
  prompt: 'Write a function that reverses a string.',
  language: 'javascript',
  testCases: [
    { id: 't1', input: 'hello', expectedOutput: 'olleh' },
    { id: 't2', input: 'a', expectedOutput: 'a', hidden: true },
  ],
};

const engine = new CodingEvaluationEngine(new DockerCodeExecutionProvider());

export async function POST(request: Request) {
  const { code } = await request.json();
  const result = await engine.evaluate(question, { code, language: 'javascript' });
  return Response.json(result);
}`}
      </CodeBlock>
      <p>
        <code>result</code> carries <code>passedCount</code>/<code>totalCount</code>,{' '}
        <code>totalScore</code> (weighted partial credit via each test case&apos;s{' '}
        <code>weight</code>), a per-test-case breakdown (hidden cases omit their input/output, not
        just the pass/fail), and flags like <code>hardcoded_solution_suspected</code> or{' '}
        <code>complexity_worse_than_expected</code> — see the package README for what each one
        actually checks and its honest limits.
      </p>

      <h2>The sandbox</h2>
      <p>
        <code>DockerCodeExecutionProvider</code> shells out to <code>docker run</code> for genuine
        OS-level isolation: no network, a read-only root filesystem, memory/CPU/process-count
        limits, a non-root user, every Linux capability dropped, <code>no-new-privileges</code>,
        and default runtime images pinned by digest. Only JavaScript and Python ship as default
        runtimes — add more via the <code>languages</code> config option. Swap in{' '}
        <code>PistonCodeExecutionProvider</code> instead for environments without Docker (e.g.
        serverless) — both implement the same <code>CodeExecutionProvider</code> interface, so
        nothing else about the route above changes.
      </p>

      <h2>What this doesn&apos;t do (yet)</h2>
      <Callout type="note">
        <ul>
          <li>
            No code editor component — you own the textarea/Monaco/CodeMirror instance and send its
            contents to your route.
          </li>
          <li>
            No wiring into <code>&lt;InterviewWidget&gt;</code>, <code>useInterview</code>, or{' '}
            <code>ServerAnswerProcessor</code> — this engine and the interview-question flow engine
            run independently; combining a coding round with a regular Q&amp;A interview in one
            session is on you to orchestrate today.
          </li>
          <li>Plagiarism / AI-generated-code detection.</li>
          <li>Multi-file submissions.</li>
        </ul>
      </Callout>
      <p>
        See the <code>@interview-sdk/coding</code> package README (
        <code>packages/coding/README.md</code> in the SDK repo) for the full API, including
        empirical complexity checking and hardcoded-solution detection.
      </p>
    </>
  );
}
