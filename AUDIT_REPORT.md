# AI Interview SDK — Code & Security Audit

Read-only review across all 8 packages (core, react, server, cli, coding, adapters,
docs/examples, tooling/CI). Pre-release (v0.0.0). Overall: 7.5/10 — strong architecture,
needs a fix pass before calling it production-perfect.

Methodology: five parallel, read-only code passes (core engine · React UI ·
server/CLI/coding-sandbox · adapters · tooling & security posture), each cross-referencing
implementation against its own test suite. The critical finding was independently
re-verified against source before being included.

## Scorecard

| Category | Score | Notes |
|---|---|---|
| Architecture | 9/10 | Clean core/react/server/adapter separation; zero-infra and sandbox claims are architecturally real. |
| Correctness | 6.5/10 | One uncaught crash bug plus several silently-swallowed error paths. |
| Security | 8/10 | Real Docker sandboxing, consistent prompt-injection guards, clean secrets — offset by under-disclosed auth gap and dashboard bind-address slip. |
| Accessibility | 7/10 | Careful contrast/focus-visible work, undercut by focus loss between questions. |
| Test coverage | 8/10 | Core engine tests are unusually thorough; newer dashboard/landing and docs/examples are thinner. |
| Docs & tooling | 8.5/10 | EDGE_CASES.md is honestly self-critical; CI/CodeQL/Dependabot properly wired. |

## Findings

### Core engine — packages/core

**[HIGH] Follow-up generation never tells the AI what's already been asked**
`follow-up/follow-up-engine.ts:104`
Scenario: a deterministic/low-temperature model asked to probe the same missed concept
produces near-identical phrasing on all 3 attempts → every attempt exceeds the 0.8
similarity threshold → the engine throws and aborts the interview instead of ever
telling the model "don't repeat these."

**[MEDIUM] `conceptCoverage[].partial` is captured but never consulted**
`follow-up/follow-up-engine.ts:74,91`
Scenario: AI marks every concept `{covered: true, partial: true}` with score 92 →
follow-up logic sees zero missed concepts and a high score, and stops probing even
though nothing was fully explained.

**[MEDIUM] Blank question IDs pass flow-engine validation but not config validation**
`flow/flow-engine.ts:33` vs `config/validate-config.ts:39`
Scenario: constructing `InterviewFlowEngine` directly (bypassing `validateInterviewConfig`)
with `{id: '', prompt: 'x'}` succeeds silently — `''` becomes a real turn/follow-up-map key.

**[MEDIUM] `sessionTimeoutMs` isn't validated by the engine itself**
`flow/flow-engine.ts:266`
Scenario: `0` is treated as "no timeout" (falsy check), while a negative value expires
the session almost immediately — only caught if the separate config validator happens
to run first.

**[LOW] `withRetry` throws `undefined` when `maxAttempts <= 0`**
`adapter/retry.ts:47`
The loop never runs, `lastError` stays unset, and `throw lastError` throws a non-Error
value. Untested.

**[LOW] `DuplicateSubmissionError` is exported but never thrown**
`errors.ts:26`
Actual duplicate-submission handling is a silent idempotent no-op — a consumer catching
this error type will never see it fire.

**[NIT] Generic error for follow-up generation exhaustion**
`follow-up/follow-up-engine.ts:120`
Throws a plain `InterviewSdkError` after exhausting attempts, unlike the more specific
`FollowUpDepthExceededError` used for the depth-exceeded case.

### React UI — packages/react

**[CRITICAL] Resuming an expired session crashes the whole widget**
`hooks/useInterview.ts:107` · `flow-engine.ts:114` · `InterviewWidget.tsx:295`
Verified against source. `resume()` calls `flow.resume()` with no try/catch, wired to
`onClick={interview.resume}`. The flow engine throws `SessionExpiredError` synchronously
once the session has expired. React error boundaries never catch event-handler
exceptions, so this crashes straight past `InterviewErrorBoundary` — a candidate who
pauses, waits past the timeout, and clicks "Resume" gets a permanently broken button
with no message.

**[HIGH] Mic stream isn't stopped if `MicButton` unmounts mid-recording**
`components/MicButton.tsx`
Scenario: candidate clicks Pause while actively recording — the widget swaps to the
paused screen, `MicButton` unmounts, but the live `getUserMedia` stream keeps running
(mic stays hot) since only the user-initiated stop path releases tracks.

**[MEDIUM] Circular refs in developer-supplied props crash outside the error boundary**
`components/InterviewWidget.tsx:136`
`JSON.stringify({questions, rubric, ...})` for the boundary's `resetKey` runs in the
outer component, before the boundary mounts. A circular reference in caller-supplied
`questions`/`rubric` throws unguarded — exactly the class of crash the boundary exists
to prevent.

**[MEDIUM] Errors from `submitAnswer` are silently discarded**
`hooks/useInterview.ts:197` · `InterviewWidget.tsx:317`
Scenario: session expires mid-question — clicking Submit rejects a promise nobody
awaits (`onSubmit={(text) => void interview.submitAnswer(text)}`), producing an
unhandled rejection and a UI that just looks frozen.

**[MEDIUM] Keyboard focus resets to the top of the widget after every question**
`components/QuestionCard.tsx:65`
`QuestionCardBody` remounts via `key={prompt}` on each new question/follow-up,
destroying whatever control held focus. A keyboard-only candidate must Tab from the
top after every single answer.

**[LOW] Ending the interview mid-scoring drops the in-flight answer's score**
`hooks/useInterview.ts:118`
Clicking "End Interview" while an answer is still being scored freezes the report at
that instant; the score lands in `transcript` later but the report already switched
views and never shows it.

**[LOW] No handling for mic disconnect or recorder error**
`components/MicButton.tsx:17`
No `onerror` handler and no listener for a track's `ended` event — a mid-capture
disconnect can leave the UI stuck showing "Recording" forever.

**[NIT] `LiveSignals` score updates aren't announced to screen readers**
`components/LiveSignals.tsx`
No `aria-live`, unlike `TranscriptChat`'s `role="log" aria-live="polite"`.

### Server, CLI & coding sandbox

**[MEDIUM] No auth or rate-limiting in the server-mode HTTP handler**
`packages/server/src/http-handler.ts:91`
Disclosed as a gap in the README, but under-flagged given how central it is: an
unauthenticated client can spam the endpoint to run up real, billed AI-provider calls.

**[MEDIUM] Dashboard CLI server binds all interfaces, not just localhost**
`packages/cli/src/commands/dashboard.ts:102`
`server.listen(port)` with no host binds `0.0.0.0`/`::` by default even though the
printed URL implies local-only.

**[LOW] Coding-sandbox test results drop stderr / compiler diagnostics**
`packages/coding/src/types.ts:64`
A product built on this can say "compile error" but never show why — a completeness
gap, not a security one.

### Provider adapters — packages/adapters/*

**[HIGH] Gemini adapter doesn't classify network/timeout errors**
`adapter-gemini/src/index.ts:90`
Only branches on Google's HTTP-response `ApiError`; a genuine connection/timeout
failure falls through as a raw `Error` instead of `ProviderConnectionError`/
`ProviderTimeoutError` — so `withRetry` won't retry it and `FailoverAdapter` won't fail
over, unlike OpenAI/Claude which both handle (and test for) this correctly.

**[MEDIUM] `retryAfterMs` is never populated on any adapter's rate-limit error**
All 5 adapters, e.g. `adapter-openai/src/index.ts:69`
A 429 with `Retry-After: 60` still falls back to generic exponential backoff (capped
~8s) and exhausts all 3 attempts in under a second.

**[MEDIUM] Silent/no-speech audio is handled inconsistently between voice adapters**
`adapter-elevenlabs/src/index.ts:92` vs `adapter-deepgram/src/index.ts:59`
The same "candidate said nothing" condition returns an empty string from ElevenLabs
but throws from Deepgram.

**[LOW] ElevenLabs stream reader isn't released on error**
`adapter-elevenlabs/src/index.ts:34`
No try/finally around `drainStream` — a connection drop mid-TTS leaves the reader lock
held and the stream uncancelled.

**[LOW] Context-length-exceeded detection diverges slightly per adapter**
`adapter-openai/index.ts:24`, `adapter-claude/index.ts:25`, `adapter-gemini/index.ts:22`
Each uses a slightly different regex on the provider's own error phrasing.

**[LOW] A malformed/undefined API response throws a raw TypeError before any adapter's own guard runs**
Shared pattern, all 5 adapters.

### Tooling, CI & docs

**[MEDIUM] `docs` and both example apps have no lint/test script — Turbo silently skips them**
`packages/docs`, `examples/basic-demo`, `examples/server-mode-nextjs` — package.json
Every other package defines matching lint/test scripts; these three don't.

**[LOW] `ci.yml` has no explicit top-level permissions block**
`.github/workflows/ci.yml`
Unlike codeql.yml's least-privilege block.

**[LOW] README's "we store nothing" headline doesn't itself surface the request-tampering trust boundary**
`README.md` vs `EDGE_CASES.md`
Not a false claim — verified architecturally true — but a reader who never opens
EDGE_CASES.md could over-trust request-tampering protections that are only "as sent"
by default.

## What's genuinely well-designed

- The coding sandbox is real, not theater: `DockerCodeExecutionProvider` runs with
  `--network=none`, read-only root, memory/CPU/PID limits, dropped capabilities,
  digest-pinned images, argv-array `spawn` (no shell injection), correct container-level
  timeout/cleanup.
- Prompt-injection defense is consistent everywhere it matters — candidate free text is
  always isolated in `user`-role messages, never concatenated into a system prompt.
- Server-mode key isolation and error sanitization are solid.
- The dashboard CLI's path-traversal protection held up against real attack payloads.
- The "I don't know" scoring fix is a genuinely thoughtful deterministic override.
- Test discipline in the core engine is well above the norm for a project this size.
- Secrets and dependency hygiene are clean across the entire tree.
