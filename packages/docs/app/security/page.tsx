import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Security & compliance' };

export default function Security() {
  return (
    <>
      <h1>Security &amp; compliance checklist</h1>
      <p className="docs-lede">
        The maintainers never operate a production service, database, or API on your behalf — see
        the Zero-Infra Guarantee in the root README. That also means most of what makes this SDK
        secure or compliant in <em>your</em> deployment is a property of how you use it, not
        something we can enforce from here. This page is that checklist.
      </p>

      <h2>Architecture-level security model</h2>
      <table>
        <thead>
          <tr>
            <th>Concern</th>
            <th>How it&apos;s handled</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>API key exposure</td>
            <td>
              Solved architecturally: Server Mode keeps every AI call, scoring, and rubric
              application in <code>@interview-sdk/server</code>, on your backend. Client Mode
              refuses to run under <code>NODE_ENV=production</code> without an explicit override.
            </td>
          </tr>
          <tr>
            <td>Score tampering</td>
            <td>
              Final scores are computed server-side; the client never has write access to the score
              object. <code>ServerAnswerProcessor</code> ignores a client-supplied question/rubric
              and only uses <code>answer.questionId</code> to look up its own canonical config.
            </td>
          </tr>
          <tr>
            <td>Prompt injection</td>
            <td>
              All candidate free-text is treated as untrusted and isolated in its own{' '}
              <code>user</code>-role message — never concatenated into the system prompt — across
              every adapter and every AI call core makes.
            </td>
          </tr>
          <tr>
            <td>Webhook spoofing</td>
            <td>
              HMAC-signed payloads (timestamped, Stripe/GitHub-style) with idempotency keys; a
              tolerance window rejects stale/replayed deliveries.
            </td>
          </tr>
          <tr>
            <td>Sandbox escape (Coding Interview Mode)</td>
            <td>
              Isolated in its own package (<code>@interview-sdk/coding</code>) so a vulnerability
              there can&apos;t reach the rest of the SDK. The default executor runs candidate code
              in Docker with <code>--network=none</code>, a read-only rootfs, and resource limits —
              never Node&apos;s <code>vm</code> module or <code>vm2</code>, both documented as
              escapable.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>What&apos;s your responsibility</h2>
      <ul>
        <li>
          Session/auth: hijacking prevention, simultaneous-login handling, and token theft
          protection are your backend&apos;s responsibility — the SDK holds no session store of its
          own.
        </li>
        <li>
          Data retention/deletion, audit logs, SSO, RBAC, and GDPR/SOC2 posture are inherited from
          your own backend and compliance program, since the SDK stores nothing on your behalf.
        </li>
        <li>
          DDoS protection is your infrastructure&apos;s responsibility — this SDK documents that
          rather than promising a firewall it can&apos;t provide for free.
        </li>
        <li>
          Reporting a vulnerability in the SDK itself: see{' '}
          <a href="https://github.com/Yuvakunaal/ai-interview-sdk/security/advisories/new">
            SECURITY.md
          </a>{' '}
          in the repo.
        </li>
      </ul>

      <h2>No secret profiling</h2>
      <p>
        Biometric and behavioral surveillance — eye-contact analysis, gesture analysis,
        &quot;another person speaking&quot; detection, emotional-intelligence scoring — ships in
        nothing by default. These categories are directly regulated in places like NYC Local Law 144
        (bias audits required) and classified high-risk under the EU AI Act; eye-contact and gesture
        analysis in particular have documented bias against neurodivergent and disabled candidates.
      </p>
      <p>If your product includes any of this:</p>
      <ul>
        <li>It must be opt-in, never a default.</li>
        <li>It must be disclosed to the candidate.</li>
        <li>
          It should auto-disable in jurisdictions that restrict AI hiring tools, unless you
          explicitly override that.
        </li>
        <li>
          Prefer low-risk integrity signals — tab-switch count, paste detection, timing anomalies —
          over biometric ones.
        </li>
      </ul>
      <blockquote>
        This isn&apos;t legal advice — get a real compliance review before shipping anything in this
        category.
      </blockquote>

      <h2>Before you go live</h2>
      <ol>
        <li>Confirm you&apos;re running Server Mode, not Client Mode, in production.</li>
        <li>
          Set <code>signingSecret</code> on <code>ServerAnswerProcessor</code> if you persist or
          reconstruct reports from client-accumulated state.
        </li>
        <li>
          Verify webhook signatures on receipt, with a tolerance window, before trusting a payload.
        </li>
        <li>
          Run the <a href="/trust-tooling">Interview Simulator</a> against an adversarial
          (prompt-injection) persona and confirm your adapter isn&apos;t swayed by it.
        </li>
        <li>
          If using Coding Interview Mode, confirm your <code>CodeExecutionProvider</code> actually
          enforces network isolation and resource limits in your deployment environment.
        </li>
        <li>
          Decide your data retention policy — the SDK stores nothing, so this is entirely yours to
          define.
        </li>
      </ol>
    </>
  );
}
