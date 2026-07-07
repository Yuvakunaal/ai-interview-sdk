import type { Metadata } from 'next';
import Link from 'next/link';
import { Callout } from '../../components/Callout';
import { CodeBlock } from '../../components/CodeBlock';

export const metadata: Metadata = { title: 'Error handling & resilience' };

export default function ErrorHandling() {
  return (
    <>
      <h1>Error handling &amp; resilience</h1>
      <p className="docs-lede">
        Every error this SDK throws is a real, typed class from <code>@interview-sdk/core</code> —
        not a generic <code>Error</code> with a message to pattern-match on. This page is the full
        list, plus the two hard limits enforced before any AI call is made, and how retries and
        config validation actually work.
      </p>

      <h2>Two hard limits, enforced before any AI call</h2>
      <p>
        Both exist to stop a pathologically large or fabricated payload from ever reaching a paid
        provider API — not to reject a genuinely long answer.
      </p>
      <div className="docs-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Error</th>
              <th>Limit</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>AnswerTooLongError</code>
              </td>
              <td>20,000 characters</td>
              <td>
                A single answer&apos;s raw text. Distinct from the <code>very_long_answer</code>{' '}
                evaluation flag, which still scores a long-but-reasonable answer — this is a hard
                stop for abuse or a client bug, not a scoring signal.
              </td>
            </tr>
            <tr>
              <td>
                <code>TooManyPreviousTurnsError</code>
              </td>
              <td>50 turns</td>
              <td>
                <code>previousTurns</code> is client-supplied (see{' '}
                <Link href="/production">Production Setup</Link>) and has no natural per-item length
                check — a client could otherwise attach an arbitrarily large fabricated history to
                inflate provider token costs on every request.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Both carry the limit and the actual value as properties (<code>error.maxLength</code>/
        <code>error.actualLength</code>, <code>error.maxTurns</code>/<code>error.actualTurns</code>)
        so you can surface a specific message rather than a generic failure.
      </p>

      <h2>The provider error taxonomy</h2>
      <p>
        Every adapter — OpenAI, Claude, Gemini, Deepgram, ElevenLabs — normalizes its own SDK&apos;s
        exceptions onto this same set, so error handling, <code>withRetry</code>, and{' '}
        <code>FailoverAdapter</code> work identically regardless of provider:
      </p>
      <div className="docs-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Error</th>
              <th>Meaning</th>
              <th>Retried by default?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>ProviderAuthError</code>
              </td>
              <td>Invalid, expired, or revoked API key; permission-denied responses.</td>
              <td>No</td>
            </tr>
            <tr>
              <td>
                <code>ProviderRateLimitError</code>
              </td>
              <td>
                Rate limit hit. Carries <code>retryAfterMs</code> if the provider supplied one.
              </td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>
                <code>ProviderOverloadedError</code>
              </td>
              <td>Provider is temporarily overloaded (e.g. HTTP 529/503).</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>
                <code>ProviderConnectionError</code>
              </td>
              <td>Network-level failure reaching the provider — no response received.</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>
                <code>ProviderTimeoutError</code>
              </td>
              <td>The request to the provider timed out.</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>
                <code>ProviderContextLengthExceededError</code>
              </td>
              <td>Candidate/developer content exceeded the model&apos;s context window.</td>
              <td>No</td>
            </tr>
            <tr>
              <td>
                <code>ProviderInvalidRequestError</code>
              </td>
              <td>Malformed request, unknown/deprecated model id, or any other 4xx.</td>
              <td>No (but is failover-eligible — see below)</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <code>MalformedAdapterResponseError</code> (carries the raw response in{' '}
        <code>error.raw</code>) and <code>AdapterNotRegisteredError</code> (from{' '}
        <code>AdapterRegistry</code>) round out the set — both indicate a config or integration
        problem, not a transient provider issue, so neither is retried.
      </p>

      <h2>
        <code>withRetry</code>
      </h2>
      <p>
        Wraps any provider call with exponential backoff, retrying only the transient errors above
        by default (rate limit, overloaded, connection, timeout) — a <code>ProviderAuthError</code>{' '}
        or <code>ProviderInvalidRequestError</code> is never retried, since repeating the same bad
        request cannot succeed:
      </p>
      <CodeBlock lang="ts">
        {`import { withRetry } from '@interview-sdk/core';

const result = await withRetry(() => adapter.complete(request), {
  maxAttempts: 3,   // default
  baseDelayMs: 250, // default
  maxDelayMs: 8000, // default
});`}
      </CodeBlock>
      <p>
        Override <code>isRetryable</code> to change which errors are retried, or <code>sleep</code>{' '}
        to control the backoff delay function itself (useful in tests). For trying a different{' '}
        <em>provider</em> instead of retrying the same one, see{' '}
        <Link href="/integrations/providers">FailoverAdapter</Link> — it uses this same taxonomy,
        plus <code>ProviderInvalidRequestError</code>, to decide when to fail over.
      </p>

      <h2>Config validation fails loud, once, up front</h2>
      <p>
        <code>validateInterviewConfig</code> checks an entire config in one pass — empty questions,
        missing rubric, invalid weights, duplicate question ids, invalid webhook URLs, and invalid
        voice/language settings — and throws a single <code>ConfigValidationError</code> listing{' '}
        <em>every</em> issue found, not just the first one:
      </p>
      <CodeBlock lang="ts">
        {`import { validateInterviewConfig } from '@interview-sdk/core';

validateInterviewConfig({ questions, rubric, voice, language });
// throws ConfigValidationError with error.issues: string[] if anything's wrong`}
      </CodeBlock>
      <Callout type="note">
        <code>InterviewConfig</code>&apos;s <code>aiProvider</code>/<code>webhook</code> fields are
        validated <em>shape</em> (a well-formed URL, etc.) but not auto-wired — you still construct
        the real <code>AIProviderAdapter</code> and <code>WebhookDispatcher</code> yourself and read
        those config values in your own glue code to decide how.
      </Callout>
      <p>
        <code>defineRubric</code> runs its own, narrower version of this at rubric-construction time
        — see the <Link href="/cookbook/rubric-evaluation">rubric cookbook</Link> for{' '}
        <code>RubricValidationError</code> specifically.
      </p>
    </>
  );
}
