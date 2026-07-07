# Edge Case Coverage

A line-by-line audit of every item in [§8 of the product spec](./Ai%20interview%20sdk%20idea.md)
against what's actually built, as of Phase 9. This exists so nobody — including a future
contributor, including us — has to guess. Every "Handled" row is backed by a test; every
"Partial" or "Not implemented" row says exactly why, rather than staying silent about it.

**Status key**

- ✅ **Handled** — built and covered by tests.
- ⚠️ **Partial** — either delegated (to the AI provider, the underlying model, or the adopting
  developer) with real SDK-level support but no dedicated test of its own, or built but with a
  known, documented limitation.
- ✗ **Not implemented** — a genuine gap. Either deferred past this build or never started.
- 🔒 **By design** — the Zero-Infra Guarantee puts this on the developer's own infrastructure on
  purpose; documented rather than falsely promised.

---

## AI Provider

| Case                        | Status | Notes                                                                                                                                                                                    |
| --------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid/expired/revoked key | ✅     | `ProviderAuthError`, normalized identically across all 3 text adapters.                                                                                                                  |
| Provider outage             | ✅     | `ProviderConnectionError` / `ProviderOverloadedError`.                                                                                                                                   |
| Rate limits                 | ⚠️     | `ProviderRateLimitError`, carries `retryAfterMs` from the provider's real `Retry-After` header on OpenAI/Claude/Deepgram/ElevenLabs. Gemini's SDK never exposes response headers on its error type, so `retryAfterMs` is always `undefined` there — `withRetry`'s exponential backoff is used instead. |
| Timeout                     | ✅     | `ProviderTimeoutError`.                                                                                                                                                                  |
| Malformed response          | ✅     | `MalformedAdapterResponseError` + zod-validated parsing (`parseAdapterJson`).                                                                                                            |
| Context/token limits        | ✅     | `ProviderContextLengthExceededError` — detected heuristically from provider error text (no provider exposes a distinct type for this).                                                   |
| Model deprecation           | ⚠️     | Surfaces as a generic `ProviderInvalidRequestError` (4xx) — no provider distinguishes "deprecated model" from any other bad request. Pair with `FailoverAdapter` for automatic fallback. |
| Regional unavailability     | ✗      | Not distinguished from a generic connection/auth failure. No region-aware logic exists.                                                                                                  |
| Failover                    | ✅     | `FailoverAdapter` — tries each configured adapter in order on a failover-eligible error.                                                                                                 |
| Retry with backoff          | ✅     | `withRetry` — exponential backoff, only for the transient subset of `Provider*Error`.                                                                                                    |
| Latency-spike handling      | ⚠️     | Indirect: a slow request that exceeds a timeout retries. No explicit spike _detection_ or alerting.                                                                                      |

## Interview Flow

| Case                                   | Status | Notes                                                                                                                                                                                                 |
| -------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No answer                              | ✅     | Empty text short-circuits to a zero score, flagged `no_answer`.                                                                                                                                       |
| Silence                                | ✅     | `isSilence` flag on the answer, same zero-score short-circuit.                                                                                                                                        |
| Skip                                   | ✅     | `isSkipped`, flagged `skipped`.                                                                                                                                                                       |
| Hint/clarification requests            | ✅     | `QuestionCard`'s hint button — a **local heuristic** (the question's declared `concepts`), not AI-generated.                                                                                          |
| Very short/long answers                | ✅     | `very_short_answer` / `very_long_answer` flags, length-thresholded.                                                                                                                                   |
| Mid-answer correction                  | ⚠️     | The textarea is editable before submit (basic correction works), but there's no explicit "candidate revised their answer" signal or flag.                                                             |
| Partial answers                        | ✅     | `conceptCoverage[].partial` is part of the schema.                                                                                                                                                    |
| Off-topic answers                      | ✅     | `off_topic` flag (AI-judged).                                                                                                                                                                         |
| Repeated questions                     | ✅     | Duplicate question ids rejected at config validation; repeated _follow-up_ prompts rejected via Jaccard similarity against `askedFollowUps`.                                                          |
| "I don't know"                         | ✅     | `i_dont_know` flag (AI-judged, not a hardcoded string match).                                                                                                                                         |
| Intentional avoidance                  | ✅     | `avoidance` flag.                                                                                                                                                                                     |
| Candidate questions to the interviewer | ⚠️     | `candidate_question` flag exists in the schema so the AI can detect it — but there's no UI for the candidate to actually ask a question back and get an answer. Flagged as a known gap since Phase 4. |

## Evaluation

| Case                                                         | Status | Notes                                                                                                                                                                                                     |
| ------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact and semantic matching                                  | ✅     | Semantic via the AI call; exact via optional `answerKey` → `matchesAnswerKey`.                                                                                                                            |
| Concept coverage                                             | ✅     | Core mechanism of the evaluation engine.                                                                                                                                                                  |
| Contradictory statements                                     | ✅     | `contradictions[]` + `contradiction` flag.                                                                                                                                                                |
| Confidence/communication/technical/example/reasoning scoring | ✅     | The rubric engine is dimension-agnostic — these are just rubric dimensions a developer defines, not hardcoded categories.                                                                                 |
| Follow-up consistency                                        | ✅     | Every evaluation call receives the full prior-turn transcript.                                                                                                                                            |
| Multi-turn evaluation                                        | ✅     | Same mechanism.                                                                                                                                                                                           |
| Language-independent scoring                                 | ⚠️     | Delegated to the underlying model's multilingual capability — core has no language-specific logic to get in the way, but this isn't independently tested by the SDK's own suite in non-English languages. |
| Bias prevention                                              | ✅     | The Bias & Consistency Harness (`interview-sdk bias-harness`) exists specifically for this.                                                                                                               |
| Hallucination prevention                                     | ⚠️     | The Bias Harness's variance detection catches _inconsistency_, which correlates with but isn't the same as catching a hallucinated rationale. No dedicated hallucination check.                           |

## Follow-Up

| Case                     | Status | Notes                                                                                                                                                              |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dynamic generation       | ✅     |                                                                                                                                                                    |
| Depth control            | ✅     | `maxFollowUpDepth`, synced between the flow engine and the follow-up engine — a real bug where these two drifted independently was caught by tests during Phase 6. |
| Infinite-loop prevention | ✅     | Hard-stopped by depth control.                                                                                                                                     |
| Repeat prevention        | ✅     | Jaccard similarity, 3 generation attempts before a clear error.                                                                                                    |
| Difficulty scaling       | ✅     | Score-based: harder ≥75, easier ≤40, same otherwise.                                                                                                               |
| Branching                | ✅     | `branches` map — a canned follow-up per concept, tried before an AI call.                                                                                          |
| Timeout handling         | ✅     | `FollowUpContext.timedOut` short-circuits generation.                                                                                                              |
| Answer tracking          | ✅     | `askedFollowUps` history per question.                                                                                                                             |

## Developer Configuration

| Case                       | Status | Notes                                                                                                                                                            |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing rubric             | ✅     | `validateInterviewConfig` fails loud, collecting every issue in one throw.                                                                                       |
| Answer key                 | 🔒     | Optional by design, not a required field — there's nothing to fail on.                                                                                           |
| Empty/duplicate questions  | ✅     |                                                                                                                                                                  |
| Invalid weights            | ✅     | Zero, negative, and NaN all rejected.                                                                                                                            |
| Invalid webhook URL        | ✅     | Checked in `validateInterviewConfig`.                                                                                                                            |
| Invalid voice/language tag | ✅     | BCP-47-ish regex check.                                                                                                                                          |
| Invalid difficulty         | ✅     | Enum-checked.                                                                                                                                                    |
| Invalid `theme`            | ✗      | The `theme?: string` field exists on `InterviewConfig` but is never validated or consumed anywhere — a vestigial field from early design, not wired to anything. |
| Invalid provider name      | ⚠️     | Not caught at config-validation time — surfaces as `AdapterNotRegisteredError` when the adapter is actually looked up, not before.                               |

## Session State

| Case                         | Status | Notes                                                                                                                                                                                                                                                                                                           |
| ---------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser refresh/crash        | ✗      | Flow state lives in memory only (a React hook / `InterviewFlowEngine` instance). No persistence or rehydration across a hard refresh is wired up automatically.                                                                                                                                                 |
| Device restart               | ✗      | Same limitation.                                                                                                                                                                                                                                                                                                |
| Session expiration           | ✅     | `sessionTimeoutMs` + `SessionExpiredError` + an `'expired'` status.                                                                                                                                                                                                                                             |
| Network disconnect/reconnect | ⚠️     | Answer submission retries implicitly after a failure, but there's no explicit offline-detection/queue-and-resume mechanism.                                                                                                                                                                                     |
| Resume                       | ⚠️     | `InterviewFlowEngine.fromState(state, config)` exists in core specifically for this — but `@interview-sdk/react`'s `useInterview` hook doesn't call it automatically. A developer who persists `flow.getState()` themselves (e.g. to `localStorage`) can rehydrate with it; this isn't wired up end-to-end yet. |
| Auto-save                    | ✗      | No automatic persistence layer exists.                                                                                                                                                                                                                                                                          |
| Duplicate submissions        | ✅     | Turn-key idempotency in the flow engine — one of the most thoroughly tested paths in the whole SDK.                                                                                                                                                                                                             |
| Multi-tab                    | ✗      | Two tabs get two independent, unsynchronized `InterviewFlowEngine` instances. No cross-tab locking or state sharing.                                                                                                                                                                                            |
| Simultaneous login           | 🔒     | No session/auth system exists in the SDK at all — this is inherently the developer's own auth layer.                                                                                                                                                                                                            |
| Hijacking prevention         | 🔒     | Explicitly documented as a Server Mode / developer responsibility, matching the spec's own framing — see the "trusts session-tracking fields as sent" note in the server package README.                                                                                                                        |

## Voice

| Case                                           | Status | Notes                                                                                                                                                                                                                  |
| ---------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mic denied/disconnected/unavailable            | ✅     | `MicButton`'s `onError` + graceful fallback — the text input is always present, never a secondary path.                                                                                                                |
| Background noise/volume/speed/accent variation | 🔒     | Per the spec's own framing, this is the voice provider's job, not the SDK's — we don't do our own audio processing.                                                                                                    |
| Multi-speaker detection                        | ✗      | No diarization support.                                                                                                                                                                                                |
| Recognition/TTS failure                        | ✅     | Surfaces as a `Provider*Error`, caught by `MicButton`'s `onError`.                                                                                                                                                     |
| Provider failure                               | ✅     | Same taxonomy as the AI adapters.                                                                                                                                                                                      |
| Latency                                        | ⚠️     | No voice-specific timeout/retry wrapping — `transcribe`/`synthesize` calls aren't automatically wrapped in `withRetry` the way evaluation calls conceptually could be; a developer who wants this wraps it themselves. |
| Audio corruption                               | ⚠️     | Empty captured audio (`size === 0`) is explicitly detected and reported; other corruption forms surface only as whatever error the provider itself returns.                                                            |
| Unsupported formats                            | ⚠️     | Delegated to the provider adapter's own error, normalized onto `Provider*Error`.                                                                                                                                       |

## Coding Interview

| Case                                                | Status | Notes                                                                                                                                                                                                                     |
| --------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compile failure                                     | ✅     | Distinct `compile_error` classification; Piston's separate compile stage makes this precise, Docker's interpreted-language runtimes have no compile step to fail.                                                         |
| Runtime error                                       | ✅     |                                                                                                                                                                                                                           |
| Infinite loop                                       | ✅     | Inferred: `infinite_loop_suspected` when _every_ test case for a submission times out.                                                                                                                                    |
| Timeout                                             | ✅     | Per-test-case wall-clock limit, enforced by the sandbox provider.                                                                                                                                                         |
| Memory exceeded                                     | ✅     | Docker: exit-code-137 heuristic (excluding our own timeout-kill). Piston: **not distinguishable** from any other kill signal — documented gap specific to that provider.                                                  |
| Partial/hardcoded solutions                         | ✅     | Weighted partial credit + `checkHardcodedSolution` (literal-output-string heuristic, documented as such).                                                                                                                 |
| Correct-output-poor-approach / incorrect complexity | ✅     | Empirical complexity check — compares measured runtime growth across differently-sized test cases against the declared `referenceComplexity`. Requires 2+ test cases with distinct `inputSize`; a heuristic, not a proof. |
| Missing edge cases                                  | ⚠️     | The engine scores whatever test cases the developer supplies, including hidden ones — but detecting "the developer's own test suite has a gap" is inherently the developer's job, not something the SDK can infer.        |
| Plagiarism / AI-generated-code detection            | ✗      | Explicitly out of scope for this build.                                                                                                                                                                                   |
| Unsupported language                                | ✅     | `UnsupportedLanguageError`, thrown before any sandbox call.                                                                                                                                                               |
| Multi-file submission                               | ✗      | `CodeExecutionRequest` takes one `code: string`. No multi-file support.                                                                                                                                                   |
| Hidden test evaluation                              | ✅     | `hidden` test cases run and score identically; their input/expected/actual output are omitted from anything shown to the candidate.                                                                                       |

## Security

| Case                         | Status | Notes                                                                                                                                                                                                                          |
| ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Key exposure                 | ✅     | Solved architecturally — Server Mode keeps keys server-side.                                                                                                                                                                   |
| Secret exposure              | ✅     | Same principle covers `signingSecret`, webhook secrets.                                                                                                                                                                        |
| Unauthorized access          | 🔒     | No auth system exists in the SDK — inherently the developer's own.                                                                                                                                                             |
| Replay attacks               | ⚠️     | Webhook deliveries: solved (timestamp + tolerance window). General API replay of an `/api/interview/answer` request: only as protected as the flow engine's own turn-key idempotency, which isn't a security mechanism per se. |
| Token theft                  | 🔒     | No session/token system in the SDK.                                                                                                                                                                                            |
| Link sharing/impersonation   | 🔒     | No invite-link system exists.                                                                                                                                                                                                  |
| Score injection/manipulation | ✅     | Server-side signing + the question/rubric trust boundary (`ServerAnswerProcessor` only trusts `answer.questionId`, never a client-supplied question/rubric body).                                                              |
| Request tampering            | ⚠️     | Question/rubric tampering: defended. `previousTurns`/`currentFollowUpDepth` tampering: trusted as sent by default — documented, not solved.                                                                                    |
| Webhook spoofing             | ✅     | HMAC-signed, Stripe/GitHub-style.                                                                                                                                                                                              |
| SQL injection                | 🔒     | The SDK has no database layer at all — not applicable to the SDK itself.                                                                                                                                                       |
| XSS                          | ✅     | No `dangerouslySetInnerHTML` anywhere in `@interview-sdk/react` — candidate text always renders through React's default escaping.                                                                                              |
| CSRF                         | ✗      | No CSRF token mechanism in the CLI-scaffolded route or `ServerAnswerProcessor` — standard same-origin JSON POST risk profile, nothing added on top.                                                                            |
| Rate-limit abuse             | ✗      | Not implemented anywhere in the request path — a developer concern.                                                                                                                                                            |

## Webhooks

| Case               | Status | Notes                                                                                                                                                   |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Failure            | ✅     | `WebhookDispatcher` retries with exponential backoff.                                                                                                   |
| Duplicate delivery | ✅     | Idempotency keys, generated or caller-supplied.                                                                                                         |
| Delayed delivery   | ✅     | The tolerance window on `verifyWebhookSignature` rejects stale (too-late) deliveries.                                                                   |
| Invalid URLs       | ✅     | Checked at config-validation time (`validateInterviewConfig`); `WebhookDispatcher` itself doesn't re-validate the URL shape before sending.             |
| Timeout            | ✗      | No explicit per-request timeout (`AbortController`) on the dispatcher's fetch call — relies on the runtime's own default.                               |
| Partial payload    | ✗      | Not specifically detected.                                                                                                                              |
| Retry queue        | ✅     | In-process, exponential backoff — explicitly documented as **not durable across restarts**, since the SDK holds no queue/database of its own by design. |
| Idempotency        | ✅     |                                                                                                                                                         |

## Reporting

| Case                       | Status | Notes                                                                                               |
| -------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| Missing/partial transcript | ✅     | `buildReport` handles an empty transcript without crashing.                                         |
| Corrupted transcript       | ✗      | No explicit validation of malformed transcript entries.                                             |
| Missing scores             | ✅     | No-data dimensions are excluded from strengths/weaknesses rather than defaulting to a misleading 0. |
| Export failure             | ✅     | PDF export failure falls back to JSON + an `onExportError` callback.                                |
| PDF/CSV generation failure | ✅     | Same fallback mechanism covers both.                                                                |
| Large-report handling      | ✗      | No pagination/streaming; untested at scale.                                                         |
| Historical retrieval       | 🔒     | The SDK stores nothing — this is entirely the developer's own persistence layer.                    |

## Multi-Language

| Case                                           | Status | Notes                                                                                                                                                                                                                |
| ---------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| English, Hindi, Telugu, mixed-language answers | ⚠️     | Delegated to the AI model's own multilingual capability — core adds no language-specific logic, but nothing in the SDK's own test suite specifically exercises Hindi/Telugu.                                         |
| RTL support                                    | ✗      | No RTL-specific layout handling in `@interview-sdk/react` components — nothing hardcodes LTR-only either, so a developer-set `dir="rtl"` on a parent may work, but this was never explicitly designed or tested for. |
| Translation failure handling                   | 🔒     | The SDK doesn't do translation itself — there's no translation layer to fail.                                                                                                                                        |
| Cross-language evaluation                      | ⚠️     | Same as language-independent scoring above — delegated, untested.                                                                                                                                                    |
| Localized reports                              | ✗      | Report text (strengths/weaknesses heuristics) is hardcoded in English.                                                                                                                                               |

## Scaling

| Case               | Status | Notes                                                                                                                                                                                                                                        |
| ------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Horizontal scaling | ✅     | The SDK holds no shared mutable state across requests — `ServerAnswerProcessor` and `InterviewFlowEngine` are stateless-friendly by construction. Actual scaling (DB throughput, concurrent sessions) is the developer's own infrastructure. |

## Enterprise

| Case                                                                    | Status | Notes                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audit logs, SSO, RBAC, org settings, data retention/deletion, GDPR/SOC2 | 🔒     | Inherited entirely from the developer's own backend and compliance posture, since the SDK stores nothing. The typed event emitter (`sessionStart`/`sessionEnd`/`scoreComputed`/etc.) is the SDK's actual contribution here — it gives developers a hook to wire their own audit logging without the SDK owning any infrastructure. |

## Cheating/Integrity Signals

| Case                                                                   | Status | Notes                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Low-risk signals (tab-switch count, paste detection, timing anomalies) | ✗      | **Not implemented.** The spec describes these as "supported opt-in," but no tab-switch, paste-detection, or timing-anomaly code exists anywhere in the codebase as of Phase 9. This is a real gap between the original plan and what shipped — flagged here rather than left silent. |
| Biometric/behavioral signals (eye contact, gesture, emotion scoring)   | ✅     | Correctly **absent** — verified by grep across every package's source: no biometric or surveillance code exists anywhere. This is the one category where "not implemented" is the guardrail working as intended, not a gap.                                                          |

## Developer Experience

| Case                                          | Status | Notes                                                                                                                                                                            |
| --------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Install failures                              | ⚠️     | Standard npm/pnpm behavior; `engines.node` constrains the Node version per package. Nothing custom.                                                                              |
| Version mismatches / breaking-change handling | ⚠️     | Changesets tooling is scaffolded (Phase 1) but has never been exercised — every package is still at `0.0.0` and nothing has been published, so real semver behavior is untested. |
| Backward compatibility                        | N/A    | Pre-1.0, nothing published yet — there's no prior version to be compatible with.                                                                                                 |
| Framework compatibility (React, Next.js)      | ✅     | Both have real, runnable examples (`packages/examples/*`).                                                                                                                       |
| Framework compatibility (Vue, Angular)        | ✗      | The original spec's "adapter pattern supports Vue/Angular" (§5) was aspirational — no Vue or Angular wrapper was built in any phase. `@interview-sdk/react` is React-only today. |
| Detailed error messages                       | ✅     | The `InterviewSdkError` hierarchy is used consistently — e.g. `ConfigValidationError` collects every issue before throwing once, rather than failing on the first problem found. |
| Sandbox/test mode                             | ✅     | The Interview Simulator (`interview-sdk simulate`), built in Phase 6.                                                                                                            |

---

## Summary

Genuine gaps worth prioritizing if this SDK continues past Phase 9, roughly in order of how load-bearing they are:

1. **Session persistence across a refresh isn't wired up in `@interview-sdk/react`**, even though the underlying capability (`InterviewFlowEngine.fromState`) exists in core.
2. **Low-risk cheating-integrity signals (tab-switch, paste detection) were never built**, despite being in the original plan — this is the most concrete plan-vs-shipped gap in the whole audit.
3. **Vue/Angular support doesn't exist** — `@interview-sdk/react` is the only UI layer.
4. **Multi-language handling is entirely delegated and untested** — it likely works because the underlying models are multilingual, but the SDK's own test suite never exercises Hindi/Telugu/mixed-language input.
5. **Multi-file coding submissions and plagiarism detection** are out of scope for Coding Interview Mode as shipped.

Everything marked 🔒 is a deliberate consequence of the Zero-Infra Guarantee, not an oversight — re-litigating those would mean giving up the "we store nothing" trust story that's the whole point of this SDK.
