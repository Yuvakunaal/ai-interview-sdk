import type { CSSProperties } from 'react';
import { useState } from 'react';

const CHECK_ICON = (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M3 8.5L6.2 11.5L13 4.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface PersonaRow {
  name: string;
  score: number;
  tier: 'pass' | 'flag' | 'neutral';
  delta: string;
}

const PERSONA_ROWS: PersonaRow[] = [
  { name: 'Strong answer', score: 94, tier: 'pass', delta: 'Δ 1.4 / 3 runs' },
  { name: 'Weak answer', score: 38, tier: 'neutral', delta: 'Δ 2.0 / 3 runs' },
  { name: 'Off-topic', score: 12, tier: 'flag', delta: 'Δ 0.6 / 3 runs' },
  { name: 'Adversarial injection', score: 41, tier: 'flag', delta: 'blocked · Δ 1.1' },
];

interface SpecRow {
  tag: string;
  name: string;
  desc: string;
}

const SPEC_ROWS: SpecRow[] = [
  {
    tag: '[EVAL]',
    name: 'Evaluation Engine',
    desc: 'Semantic concept matching, partial coverage, contradiction detection, hybrid AI + answer-key scoring.',
  },
  {
    tag: '[FUP]',
    name: 'Follow-Up Engine',
    desc: "Depth-limited, repeat-preventing follow-ups generated from the candidate's own answer, with difficulty scaling.",
  },
  {
    tag: '[RUB]',
    name: 'Rubric Engine',
    desc: 'Developer-defined weighted dimensions. Fails loud on invalid or empty configuration — never silently.',
  },
  {
    tag: '[VOICE]',
    name: 'Voice Layer',
    desc: 'OpenAI, Deepgram, ElevenLabs, or your own adapter — request/response by design, so a mic-denied or silence-marked turn always falls back to the visible text field.',
  },
  {
    tag: '[I18N]',
    name: 'Multi-Language',
    desc: "English, Hindi, Telugu, and mixed-language answers — evaluation delegates to your model's own multilingual understanding, no SDK-side translation layer.",
  },
  {
    tag: '[RPT]',
    name: 'Reports',
    desc: 'JSON, PDF, and CSV export — full transcript plus strengths, weaknesses, and missed concepts.',
  },
  {
    tag: '[HOOK]',
    name: 'Webhooks',
    desc: 'HMAC-signed payloads, idempotency keys, retry with exponential backoff.',
  },
  {
    tag: '[A11Y]',
    name: 'Accessibility',
    desc: 'Captions, full keyboard navigation, screen-reader markup, and a text-only mode — by default, not by request.',
  },
  {
    tag: '[RES]',
    name: 'Provider Resilience',
    desc: 'Retry with backoff, multi-provider failover — a deprecated or invalid model is classified and routed to your fallback provider automatically.',
  },
  {
    tag: '[OBS]',
    name: 'Observability',
    desc: 'A typed event emitter for session, score, and follow-up events — pipe into your own analytics.',
  },
  {
    tag: '[CODE]',
    name: 'Coding Mode',
    desc: 'Sandboxed execution, timeout and infinite-loop detection, partial-credit scoring.',
  },
  {
    tag: '[TRUST]',
    name: 'Developer Trust Tooling',
    desc: 'The Interview Simulator and Bias & Consistency Harness shown above — validate the rubric before a candidate does.',
  },
];

const GITHUB_URL = 'https://github.com/Yuvakunaal/ai-interview-sdk';

export function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="nav">
        <div className="nav-inner">
          <a className="wordmark" href="#top" onClick={closeMenu}>
            @interview<span>-sdk</span>
          </a>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="primary-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
          <nav
            id="primary-nav"
            className={menuOpen ? 'nav-links is-open' : 'nav-links'}
            aria-label="Primary"
          >
            <a href="#architecture" onClick={closeMenu}>
              Architecture
            </a>
            <a href="#spec" onClick={closeMenu}>
              Spec sheet
            </a>
            <a href="#start" onClick={closeMenu}>
              Quickstart
            </a>
            <a href="/docs" onClick={closeMenu}>
              Docs
            </a>
            <a
              className="nav-github"
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
            >
              GitHub ↗
            </a>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="hero" id="top">
          <div className="wrap hero-inner">
            <div className="hero-copy">
              <p className="eyebrow">Open source · self-hosted · MIT licensed</p>
              <h1>Prove your rubric is fair, before a candidate ever sees it.</h1>
              <p className="lede">
                @interview-sdk is the infrastructure layer for AI-scored interviews — your API
                keys, your backend, your database. Every rubric ships with a Bias &amp;
                Consistency Harness: run it against scripted candidates first, and read the
                variance report before anyone real answers a question.
              </p>
              <div className="cta-row">
                <a className="cta-primary" href="#start">
                  <span>Get started</span>
                  <code>npm install @interview-sdk/core</code>
                </a>
                <a
                  className="cta-secondary"
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View source ↗
                </a>
              </div>
            </div>

            <div className="hero-figure">
              <div
                className="scorecard"
                role="img"
                aria-label="Bias and consistency report. Same rubric scored against four scripted personas: strong answer scores 94 with 1.4 points of variance across three runs; weak answer scores 38 with 2.0 variance; off-topic scores 12 with 0.6 variance; an adversarial prompt-injection attempt is blocked and scores 41 with 1.1 variance."
              >
                <div className="scorecard-head">
                  <span className="scorecard-title">Bias &amp; Consistency Report</span>
                  <span className="scorecard-stamp">
                    {CHECK_ICON}
                    Verified
                  </span>
                </div>
                <ul className="persona-rows">
                  {PERSONA_ROWS.map((persona, i) => (
                    <li
                      className="persona-row"
                      key={persona.name}
                      style={{ '--d': i } as CSSProperties}
                    >
                      <span className="persona-name">{persona.name}</span>
                      <span
                        className={[
                          'persona-score',
                          persona.tier === 'neutral' ? undefined : persona.tier,
                          'tabular',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {persona.score}
                      </span>
                      <span className="persona-delta">{persona.delta}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="figure-caption">
                Fig. 1 — same rubric, four scripted personas, verified before go-live.
              </p>
            </div>
          </div>
        </section>

        <section className="wrap" id="architecture">
          <p className="section-kicker">Architecture</p>
          <h2>Two ways to run it.</h2>
          <div className="pipeline">
            <div className="pipeline-node">
              <span className="node-label">Developer App</span>
              <span className="node-sub">React</span>
            </div>
            <div className="pipeline-line" aria-hidden="true" />
            <div className="pipeline-node">
              <span className="node-tag">@interview-sdk/react</span>
              <span className="node-sub">Widgets, hooks, accessibility</span>
            </div>
            <div className="pipeline-line" aria-hidden="true" />
            <div className="pipeline-node">
              <span className="node-tag">@interview-sdk/core</span>
              <span className="node-sub">Flow, evaluation, rubric, follow-up engine</span>
            </div>
            <div className="pipeline-line" aria-hidden="true" />

            <div className="pipeline-split">
              <div className="pipeline-branch">
                <span className="branch-label">Client Mode</span>
                <p>
                  Runs directly in the browser against your adapter. Fast to demo — refuses to
                  start under <code>NODE_ENV=production</code> without an explicit override.
                </p>
              </div>
              <div className="pipeline-branch pipeline-branch--recommended">
                <span className="branch-label">
                  Server Mode <em>— recommended</em>
                </span>
                <p>
                  Every answer is scored by <code>@interview-sdk/server</code> on your backend.
                  Keys stay put; the client never has write access to the score.
                </p>
                <div className="branch-end">↳ your database · auth · storage</div>
              </div>
            </div>
          </div>
        </section>

        <section className="wrap" id="spec">
          <p className="section-kicker">Spec sheet</p>
          <h2>What ships in core.</h2>
          <ul className="spec-rows">
            {SPEC_ROWS.map((row) => (
              <li className="spec-row" key={row.tag}>
                <span className="spec-tag">{row.tag}</span>
                <span className="spec-name">{row.name}</span>
                <span className="spec-desc">{row.desc}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="wrap manifesto">
          <blockquote>
            <p>
              &ldquo;You hold the API keys. You hold the database. You hold the candidate&apos;s
              data. We hold none of it — not at ten users, not at ten thousand.&rdquo;
            </p>
          </blockquote>
          <p className="manifesto-note">— the only thing we maintain is the domain name.</p>
        </section>

        <section className="wrap">
          <p className="section-kicker">Ethics</p>
          <h2>No secret profiling.</h2>
          <p className="ethics-body">
            Biometric and behavioral surveillance — eye contact, gesture, emotion scoring — ships
            in nothing. Not as a default, not as an opt-in toggle: there&apos;s no hook for it at
            all. If your product needs integrity signals, prefer low-risk ones — tab-switch
            count, paste detection, timing anomalies — built into your own adapter layer, and get
            a real compliance review before shipping anything in this category in a regulated
            jurisdiction.
          </p>
        </section>

        <section className="wrap" id="start">
          <p className="section-kicker">Quickstart</p>
          <h2>Running in one file.</h2>
          <div className="code-panel">
            <span className="lang">bash</span>
            <pre>
              <code>npm install @interview-sdk/core @interview-sdk/react @interview-sdk/server</code>
            </pre>
            <span className="lang">tsx</span>
            <pre>
              <code>{`<InterviewWidget
  questions={questions}
  rubric={rubric}
  mode="server"
  apiBaseUrl="/api/interview/answer"
/>`}</code>
            </pre>
          </div>
          <p className="quickstart-caption">
            Client Mode gets a demo running same-day. Server Mode — shown here — is what you
            ship.
          </p>
        </section>
      </main>

      <footer className="footer wrap">
        <pre className="tree">{'@interview-sdk/\n├── '}<b>core</b>
          {'        flow, evaluation, rubric, follow-up engine\n├── '}<b>react</b>
          {'       InterviewWidget, MicButton, QuestionCard, ReportCard…\n├── '}<b>server</b>
          {'      production scoring, HMAC signing, webhooks\n├── '}<b>cli</b>
          {'         scaffolding, simulator, bias harness\n└── '}<b>adapter-*</b>
          {'   openai · claude · gemini · deepgram · elevenlabs'}</pre>
        <p className="footer-note">
          MIT licensed. Self-hosted. Maintained at{' '}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            github.com/Yuvakunaal/ai-interview-sdk
          </a>
          .
        </p>
      </footer>
    </>
  );
}
