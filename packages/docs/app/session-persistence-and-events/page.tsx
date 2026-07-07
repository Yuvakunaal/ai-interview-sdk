import type { Metadata } from 'next';
import { Callout } from '../../components/Callout';
import { CodeBlock } from '../../components/CodeBlock';

export const metadata: Metadata = { title: 'Session persistence & events' };

export default function SessionPersistenceAndEvents() {
  return (
    <>
      <h1>Session persistence &amp; events</h1>
      <p className="docs-lede">
        <code>InterviewFlowEngine</code>, the state machine <code>@interview-sdk/react</code> itself
        is built on, exposes two capabilities that the React layer doesn&apos;t surface yet:
        resuming a session after a refresh, and a typed event stream for observability.
      </p>

      <Callout type="note">
        Both of these are <code>@interview-sdk/core</code> APIs today. <code>useInterview</code> and{' '}
        <code>&lt;InterviewWidget&gt;</code> don&apos;t expose the underlying flow engine instance
        yet — reach for these directly if you&apos;re driving the flow engine yourself (a custom UI,
        a non-React frontend, or a backend process), not through the React components.
      </Callout>

      <h2>Resuming after a refresh or disconnect</h2>
      <p>
        <code>getState()</code> returns a plain, serializable snapshot of the whole session;{' '}
        <code>InterviewFlowEngine.fromState()</code> reconstructs an equivalent engine from one —
        persist the snapshot yourself (your own database, a signed cookie, wherever), and rebuild
        the engine from it on the next request or page load:
      </p>
      <CodeBlock lang="ts">
        {`import { InterviewFlowEngine } from '@interview-sdk/core';

const flow = new InterviewFlowEngine({ questions });
flow.start();

const snapshot = flow.getState();
// ...persist snapshot somewhere durable...

// later, in a new process or after a refresh:
const resumed = InterviewFlowEngine.fromState({ questions }, snapshot);`}
      </CodeBlock>
      <p>
        <code>pause()</code> and <code>resume()</code> are ordinary state transitions on the same
        engine — pausing doesn&apos;t stop a timer or background job of its own, since this package
        holds no session store or scheduler (Zero-Infra Guarantee). The engine also enforces session
        expiration and rejects a duplicate submission for the same turn on its own, regardless of
        whether you&apos;re persisting state between calls.
      </p>

      <h2>Typed events</h2>
      <p>
        <code>InterviewEventEmitter</code> gives you a subscribable stream of session lifecycle
        events — useful for piping into your own analytics or logging, independent of whatever UI is
        (or isn&apos;t) attached:
      </p>
      <CodeBlock lang="ts">
        {`import type { InterviewEventEmitter } from '@interview-sdk/core';

// flow.events is an InterviewEventEmitter
const unsubscribe = flow.events.on('scoreComputed', ({ sessionId, questionId, result }) => {
  myAnalytics.track('interview_question_scored', { sessionId, questionId, score: result.totalScore });
});

// later:
unsubscribe();`}
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
        structurally cannot compute a real score. Get the real total from <code>useInterview</code>
        &apos;s <code>onSessionEnd</code> callback (<code>InterviewReport.totalScore</code>) or by
        aggregating your own <code>scoreComputed</code> listeners — never by inferring it from this
        event.
      </Callout>
    </>
  );
}
