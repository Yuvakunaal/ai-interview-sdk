import type { Metadata } from 'next';
import { Callout } from '../../components/Callout';
import { CodeBlock } from '../../components/CodeBlock';

export const metadata: Metadata = { title: 'Session persistence & events' };

export default function SessionPersistenceAndEvents() {
  return (
    <>
      <h1>Session persistence &amp; events</h1>
      <p className="docs-lede">
        Two capabilities most interview widgets don&apos;t bother with: resuming a session after a
        refresh, and a typed event stream for your own analytics — independent of whatever UI is
        (or isn&apos;t) attached. Both are available directly from <code>useInterview</code>.
      </p>

      <h2>Resuming after a refresh or disconnect</h2>
      <p>
        The zero-config path: pass <code>persistKey</code> to <code>&lt;InterviewWidget&gt;</code>{' '}
        and it handles the rest — saving a snapshot to <code>localStorage</code> after every state
        change, and resuming from it on mount. A page refresh or an accidentally-closed tab picks
        back up on the same question with the same transcript; the lobby never shows twice.
      </p>
      <CodeBlock lang="tsx">
        {`<InterviewWidget
  questions={questions}
  rubric={rubric}
  mode="server"
  persistKey={\`interview-\${candidateId}\`}
/>`}
      </CodeBlock>
      <Callout type="warning">
        Use a key that&apos;s unique per candidate and interview — e.g. include a candidate or
        session id, like the example above. A shared/generic key on a shared browser profile would
        resume one candidate&apos;s in-progress answers for the next person who opens the page.
        Persistence is best-effort: a full, disabled, or private-browsing-restricted{' '}
        <code>localStorage</code> degrades silently to a fresh session, never a crash. The
        snapshot is cleared automatically once the interview completes or expires.
      </Callout>
      <p>
        Under the hood this is just <code>useInterview</code>&apos;s own primitives, exposed
        directly if you&apos;re building a custom UI: <code>getSnapshot()</code> returns a plain,
        serializable object covering the whole session (flow state and transcript); pass it back in
        as <code>initialSnapshot</code> to reconstruct the exact same session — same question
        index, same transcript, same follow-up depth.
      </p>
      <CodeBlock lang="tsx">
        {`import { useInterview } from '@interview-sdk/react';

const interview = useInterview({ questions, rubric, processor, initialSnapshot });

// after every change worth persisting:
localStorage.setItem('interview-snapshot', JSON.stringify(interview.getSnapshot()));

// on mount, before rendering:
const saved = localStorage.getItem('interview-snapshot');
const initialSnapshot = saved ? JSON.parse(saved) : undefined;`}
      </CodeBlock>
      <p>
        <code>initialSnapshot</code> is only read once, on mount — passing a new value on a later
        render doesn&apos;t reset an in-progress session. A snapshot whose <code>sessionTimeoutMs</code>{' '}
        already elapsed by the time it&apos;s resumed correctly reads as <code>&apos;expired&apos;</code>{' '}
        immediately, not a stale <code>&apos;in_progress&apos;</code> that only fails once the
        candidate tries to submit. <code>pause()</code> and <code>resume()</code> are ordinary state
        transitions on top of the same mechanism; the engine enforces session expiration and rejects
        a duplicate submission for the same turn on its own, regardless of whether you&apos;re
        persisting state between calls.
      </p>

      <h2>Integrity signals (tab switches &amp; pastes)</h2>
      <p>
        <code>&lt;InterviewWidget trackIntegritySignals&gt;</code> (off by default) tracks two
        low-risk, non-biometric signals while the interview is active — how many times the
        candidate&apos;s tab lost focus, and how many times they pasted into an answer — and
        attaches them to the final report as <code>integritySignals</code>:
      </p>
      <CodeBlock lang="ts">
        {`interface IntegritySignals {
  tabSwitchCount: number;
  tabSwitchTimestamps: number[];
  pasteEvents: Array<{ length: number; timestamp: number }>;
}`}
      </CodeBlock>
      <Callout type="warning">
        These are observations for a human reviewer to weigh in context — not an automated
        cheating verdict, and nothing like the biometric/behavioral signals (eye contact, gesture,
        emotion scoring) this SDK deliberately never implements. If you turn this on, disclose it
        to candidates — most interview platforms that track tab-switching say so up front.
      </Callout>

      <h2>Typed events</h2>
      <p>
        <code>useInterview</code> also returns <code>events</code> — a subscribable{' '}
        <code>InterviewEventEmitter</code> — so you can pipe session activity into your own
        analytics without threading callbacks through every UI layer:
      </p>
      <CodeBlock lang="tsx">
        {`import { useInterview } from '@interview-sdk/react';
import { useEffect } from 'react';

const interview = useInterview({ questions, rubric, processor });

useEffect(() => {
  const unsubscribe = interview.events.on('scoreComputed', ({ sessionId, questionId, result }) => {
    myAnalytics.track('interview_question_scored', { sessionId, questionId, score: result.totalScore });
  });
  return unsubscribe;
}, [interview.events]);`}
      </CodeBlock>
      <div className="docs-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>sessionStart</code>
              </td>
              <td>
                <code>{'{ sessionId }'}</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>sessionPause</code> / <code>sessionResume</code>
              </td>
              <td>
                <code>{'{ sessionId }'}</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>sessionEnd</code> / <code>sessionExpired</code>
              </td>
              <td>
                <code>{'{ sessionId }'}</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>questionAdvance</code>
              </td>
              <td>
                <code>{'{ sessionId, questionId, index }'}</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>followUpGenerated</code>
              </td>
              <td>
                <code>{'{ sessionId, questionId, prompt, depth }'}</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>scoreComputed</code>
              </td>
              <td>
                <code>{'{ sessionId, questionId, result }'}</code> — a full{' '}
                <code>EvaluationResult</code>.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Callout type="warning">
        <code>sessionEnd</code> deliberately carries no <code>totalScore</code> — the flow engine
        only ever sees a <code>CandidateAnswer</code>, never an <code>EvaluationResult</code>, so it
        structurally cannot compute a real score. Get the real total from{' '}
        <code>useInterview</code>&apos;s <code>onSessionEnd</code> callback (
        <code>InterviewReport.totalScore</code>) or by aggregating your own{' '}
        <code>scoreComputed</code> listeners — never by inferring it from this event.
      </Callout>

      <h2>Without React: driving the flow engine directly</h2>
      <p>
        Both capabilities exist at the <code>@interview-sdk/core</code> level too —{' '}
        <code>useInterview</code> is a thin wrapper over exactly this. Reach for it directly if
        you&apos;re building a non-React frontend, a custom UI, or driving sessions from a backend
        process:
      </p>
      <CodeBlock lang="ts">
        {`import { InterviewFlowEngine } from '@interview-sdk/core';

const flow = new InterviewFlowEngine({ questions });
flow.start();

const snapshot = flow.getState();
// ...persist snapshot somewhere durable...

// later, in a new process or after a refresh:
const resumed = InterviewFlowEngine.fromState(snapshot, { questions });

// flow.events is the same InterviewEventEmitter useInterview exposes:
flow.events.on('scoreComputed', ({ sessionId, questionId, result }) => {
  myAnalytics.track('interview_question_scored', { sessionId, questionId, score: result.totalScore });
});`}
      </CodeBlock>
    </>
  );
}
