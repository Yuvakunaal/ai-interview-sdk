
# AI Interview SDK — Complete Product Specification

> Open-source TypeScript/React infrastructure for embedding AI-powered interviews into any application, with your own AI keys, backend, and database. Built complete, in one release — no phased rollout.

---

## 0. Design Decisions Locked In

| Decision | Detail |
|---|---|
| Package naming | Unified under `@interview-sdk/*` scoped namespace |
| Client-side only architecture | Rejected — API keys and scores must never live only in the browser |
| Production execution path | `@interview-sdk/server` runs on the *developer's* infra — zero cost to the SDK maintainer |
| Cheating/behavioral detection | Opt-in, region-gated, disclosed to candidates — not shipped as default (legal exposure under NYC Local Law 144, EU AI Act, BIPA) |
| Rubric/evaluation testing | Built-in Interview Simulator + Bias Testing Harness — not left to chance |
| Maintainer budget | Domain name only (~$10–15/yr). Everything else free by design. |
| Onboarding | Setup Walkthrough Video (YouTube, free) instead of a live interactive demo — a live demo needs a funded API key strangers can drain |

---

## 1. Vision

Enable developers to add production-grade AI interviews to any application — as infrastructure they own, not a platform they rent.

**The SDK is:** a developer tool.
**The SDK is not:** an interview platform, a SaaS product, or a data controller.

---

## 2. Core Philosophy

**Developer owns:** AI keys, backend, database, auth, storage, user accounts, infrastructure, candidate data.

**SDK provides:** interview UI, flow orchestration, follow-up logic, evaluation engine, rubric scoring, report generation, voice integration, session management, and an extensibility layer.

**Non-negotiables:**
- No vendor lock-in
- No forced backend
- No required cloud service
- No candidate data stored by SDK maintainers
- No default surveillance features

---

## 2.1 Maintainer Zero-Infra Guarantee

**Rule: the maintainer never pays for backend compute or storage. Not at 10 users, not at 10,000.**

| Component | Where it runs / is hosted | Cost to maintainer |
|---|---|---|
| Docs site | Static, on Vercel/Netlify/GitHub Pages free tier | $0 |
| `@interview-sdk/server` | Runs on the *adopting developer's* infra | $0 |
| Question Pack Marketplace | Distributed as npm packages, npm hosts the registry | $0 |
| Interview Simulator | Runs locally via CLI, in the developer's own machine/CI | $0 |
| Bias Testing Harness | Local/CI execution, developer's own AI provider keys | $0 |
| Telemetry/analytics | None by default — developers wire their own via the event emitter | $0 |
| Website/marketing | Static site, free-tier hosting | $0 |
| Setup Walkthrough Video | YouTube hosting | $0 |
| Domain name | — | ~$10–15/yr (the one planned spend) |

**Litmus test for every feature:** "does this require me to run a server or database?" If yes, it gets redesigned to run on the developer's infra/CLI, or it doesn't ship.

**If monetizing later:** avoid a license-check server or hosted "Pro" tier — both reintroduce backend cost. Prefer premium Question Packs sold through an existing marketplace (Gumroad, npm), sponsorships, or paid support — never a billing backend you host.

---

## 3. Target Users

EdTech platforms, LMS platforms, coding bootcamps, hiring platforms, training platforms, universities, assessment products, internal L&D systems — anyone building mock interviews, placement prep, recruitment tools, or employee assessments who doesn't want to build interview infrastructure from scratch.

---

## 4. Architecture

```
Developer App (React)
        │
        ▼
@interview-sdk/react   ← UI components, hooks
        │
        ▼
@interview-sdk/core    ← flow logic, evaluation, rubric, follow-up engine
        │
        ├──► Client Mode (prototyping): calls AI provider directly from browser
        │
        └──► Server Mode (production, recommended):
                    ▼
             @interview-sdk/server  ← runs in developer's backend
                    │
                    ▼
             Developer's DB + Auth + Storage
```

Client Mode gets a working demo running fast but exposes API keys and lets scores be tampered with client-side — clearly labeled "prototyping only." Server Mode routes evaluation, scoring, and follow-up generation through the developer's own backend using the same `@interview-sdk/core` logic, so keys stay server-side and scores can't be forged. This single design decision resolves the API-key-leakage, score-tampering, and replay-attack problems at the architecture level.

---

## 5. Technology Stack

- **Core engine:** TypeScript (framework-independent)
- **UI layer:** React (Vue/Angular adapters supported via the adapter pattern)
- **Docs:** Next.js
- **Packaging:** npm, scoped under `@interview-sdk/*`
- **Build:** tsup

### Package Structure

```
packages/
├── core/       @interview-sdk/core     — flow, evaluation, rubric, follow-up engine
├── react/      @interview-sdk/react    — widgets, hooks, mic/report components
├── server/     @interview-sdk/server   — production-mode evaluation, key isolation
├── cli/        @interview-sdk/cli      — scaffolding, simulator, bias harness, question-pack management
├── adapters/   @interview-sdk/adapter-openai, -deepgram, -elevenlabs, -gemini, -claude
├── examples/
└── docs/
```

---

## 6. Developer Experience

**Install:**
```bash
npm install @interview-sdk/core @interview-sdk/react
```
```tsx
<InterviewWidget
  questions={questions}
  rubric={rubric}
  aiProvider="openai"
/>
```

**Production scaffold:**
```bash
npx @interview-sdk/cli init --mode=server
```
Scaffolds a minimal backend route using `@interview-sdk/server` — production security from the start, not a bolt-on.

---

## 7. Complete Feature Set

**Session Management**
Start/pause/resume/end, current-question tracking, progress and timing, auto-save, resume after refresh/disconnect, duplicate-submission prevention, multi-tab handling.

**Evaluation Engine**
Semantic (not keyword) matching, concept-based scoring, partial concept coverage, missing/incorrect concept detection, contradictory-statement handling, multi-turn consistency checks, hallucination checks (via Bias Harness), rubric-based scoring, hybrid AI + answer-key scoring.

**Dynamic Follow-Up Engine**
Generation based on candidate answers, max-depth limits, repeat-prevention, difficulty scaling, branching logic, timeout handling.

**Rubric Engine**
Developer-defined weighted dimensions (technical, communication, confidence, examples, or fully custom), weight validation at init (fails loud on invalid/empty config), scored breakdown + total.

**React Components**
`InterviewWidget`, `MicButton`, `QuestionCard`, `ReportCard`, `TranscriptViewer`, `ScoreSummary`.

**Voice Layer**
Multi-provider abstraction (OpenAI, Deepgram, ElevenLabs, custom), graceful fallback to text input on mic denial/failure/empty audio, provider-documented handling of background noise and accent variation.

**Multi-Language Support**
English, Hindi, Telugu, and mixed-language answers; cross-language evaluation; localized reports.

**Report Generation**
JSON, PDF, and CSV export; transcript + score + strengths/weaknesses + recommendations; graceful fallback to JSON if PDF/CSV generation fails.

**Webhooks**
HMAC-signed payloads, idempotency keys, retry queue, delayed-delivery handling.

**Accessibility**
Captions, text-only fallback mode, screen-reader-friendly components, full keyboard navigation.

**Provider Resilience**
Retry with exponential backoff, multi-provider failover, malformed-response validation, context/token-limit handling, model-deprecation handling.

**Observability**
Typed event emitter (`onSessionStart`, `onFollowUpGenerated`, `onScoreComputed`, `onSessionEnd`, etc.) so developers pipe into their own analytics without the SDK owning infrastructure.

**Coding Interview Mode**
Compile/runtime error handling, timeout/infinite-loop detection, partial-solution scoring, correct-output-poor-approach detection, complexity analysis, sandboxed execution.

**Ecosystem Layer**
Adapter Registry (one-line provider swaps, third-party publishable), Question Pack Marketplace (`@interview-sdk/pack-*` npm packages — system design, DSA, behavioral, sales, data science, and community-contributed packs).

**Developer Trust Tooling**
Interview Simulator (headless, scripted "fake candidate" personas — strong/weak/off-topic/silent/adversarial — validates rubric and follow-up behavior before real candidates see it), Bias & Consistency Testing Harness (labeled sample sets scored against the rubric, variance/consistency report).

**Configuration Validation**
Fails loud on empty questions, missing rubric, invalid weights, duplicate questions, invalid webhook/callback URLs, invalid voice/language settings.

---

## 8. Edge Case Coverage

**AI Provider:** invalid/expired/revoked key, provider outage, rate limits, timeout, malformed response, context/token limits, model deprecation, regional unavailability, failover, retry with backoff, latency-spike handling.

**Interview Flow:** no answer, silence, skip, hint/clarification requests, very short/long answers, mid-answer correction, partial answers, off-topic answers, repeated questions, "I don't know," intentional avoidance, candidate questions to the interviewer.

**Evaluation:** exact and semantic matching, concept coverage, contradictory statements, confidence/communication/technical/example/reasoning scoring, follow-up consistency, multi-turn evaluation, language-independent scoring, bias prevention, hallucination prevention.

**Follow-Up:** dynamic generation, depth control, infinite-loop prevention, repeat prevention, difficulty scaling, branching, timeout handling, answer tracking.

**Developer Configuration:** missing answer key/rubric, empty/duplicate questions, invalid weights, invalid settings across provider/webhook/theme/voice/language/difficulty.

**Session State:** browser refresh/crash, device restart, session expiration, network disconnect/reconnect, resume, auto-save, duplicate submissions, multi-tab, simultaneous login, hijacking prevention (Server Mode responsibility, documented).

**Voice:** mic denied/disconnected/unavailable, background noise, volume/speed variation, accent variation, multi-speaker detection, recognition/TTS failure, provider failure, latency, audio corruption, unsupported formats.

**Coding Interview:** compile failure, runtime error, infinite loop, timeout, memory exceeded, partial/hardcoded solutions, correct-output-poor-approach, incorrect complexity, missing edge cases, plagiarism and AI-generated-code detection, unsupported language, multi-file submission, hidden test evaluation.

**Security:** key exposure (solved architecturally via Server Mode), secret exposure, unauthorized access, replay attacks, token theft, link sharing/impersonation, score injection/manipulation (solved via server-side signing), request tampering, webhook spoofing (HMAC-signed), SQL injection, XSS, CSRF, rate-limit abuse. DDoS protection is the developer's infra responsibility — the SDK documents this rather than promising a firewall it can't provide for free.

**Webhooks:** failure, duplicate delivery, delayed delivery, invalid URLs, timeout, partial payload, retry queue, idempotency.

**Reporting:** missing/partial/corrupted transcript, missing scores, export failure, PDF/CSV generation failure, large-report handling, historical retrieval.

**Multi-Language:** English, Hindi, Telugu, mixed-language answers, RTL support, translation failure handling, cross-language evaluation, localized reports.

**Scaling:** the SDK is stateless-friendly by design so it never blocks horizontal scaling — actual scaling (concurrent interviews, DB throughput, storage) is the developer's infra, since the SDK holds no central database by design.

**Enterprise:** audit logs, SSO, RBAC, org settings, data retention/deletion, GDPR/SOC2 — inherited from the developer's own backend and compliance posture, since the SDK stores nothing. A Compliance Checklist is documented rather than falsely promising built-in compliance.

**Cheating/Integrity Signals:** low-risk signals (tab-switch count, paste detection, timing anomalies) supported opt-in. Biometric/behavioral signals (eye contact, gesture, "another person speaking," emotion scoring) are available only opt-in, disclosed to candidates, and auto-disabled in jurisdictions with AI-hiring restrictions — see §9.

**Developer Experience:** install failures, version mismatches, breaking-change handling, backward compatibility, framework compatibility (React/Vue/Angular/Next.js), detailed error messages, sandbox/test mode via the Interview Simulator.

---

## 9. Ethical & Legal Guardrails

Biometric and behavioral surveillance features used in hiring decisions — tab-switch detection, eye-contact analysis, gesture analysis, "another person speaking," emotional-intelligence scoring — are directly regulated in places like **NYC Local Law 144** (bias audits required) and classified as **high-risk under the EU AI Act**. Eye-contact and gesture analysis in particular has documented bias against neurodivergent and disabled candidates. Biometric capture triggers laws like **Illinois BIPA** with real statutory penalties.

*(Not legal advice — worth a real compliance review before shipping this category — but a solvable product problem, not a reason to avoid the space.)*

**How it's handled:**
- None of this ships as a default.
- If included, it's opt-in, disclosed to candidates, and auto-disabled by jurisdiction unless the developer explicitly overrides.
- Low-risk integrity signals (tab-switch count, paste-detection, timing anomalies) are preferred over biometric ones.
- Documented clearly so adopting developers understand the liability they're taking on.

This is also a differentiator: "the AI interview SDK that doesn't secretly profile candidates" is a real trust story, especially after the well-publicized Cluely-style data breach in this space.

---

## 10. Security Model

- **Client Mode:** prototyping only, clearly labeled; refuses to run in `NODE_ENV=production` without an explicit override flag.
- **Server Mode:** all AI calls, scoring, and rubric application happen in `@interview-sdk/server`. The client only renders UI and streams audio/text.
- **Score integrity:** final scores are computed and signed server-side; the client never has write access to the score object.
- **Webhooks:** HMAC-signed payloads + idempotency keys prevent spoofing and duplicate processing.
- **Input handling:** all candidate free-text is treated as untrusted before being interpolated into any AI provider prompt — structured message roles, not string concatenation, to mitigate prompt injection.

---

## 11. Developer Trust Tooling

**Interview Simulator** (`@interview-sdk/cli simulate`) — a headless mode where scripted or LLM-driven "fake candidate" personas (strong answer, weak answer, off-topic, silent, adversarial/prompt-injection attempt) answer the question bank, so developers validate rubric and follow-up behavior before a real candidate ever sees it.

**Bias & Consistency Testing Harness** — developers supply a labeled sample set (answer + expected score range), run it against their rubric + AI provider, and get a consistency/variance report. This directly answers the hardest question every adopter will ask: "how do I know this LLM grading is fair and consistent?"

---

## 12. Extensibility: The Ecosystem Layer

- **Adapter Registry:** unified provider interface (`@interview-sdk/adapter-*`) — swap AI/voice providers with a one-line config change. Third parties can publish their own adapters.
- **Question Pack Marketplace:** open JSON/YAML format for question sets + rubrics + concept maps, published as `@interview-sdk/pack-*` npm packages (system design, DSA, behavioral, sales, data science, community-contributed). This is the real distribution moat — the SDK becomes the layer that content is built on top of, not just a code library.
- **Typed Event Emitter:** lets developers wire their own analytics/webhooks without the SDK owning any infrastructure.

---

## 13. Documentation Requirements

- **Setup Walkthrough Video** (YouTube-hosted, embedded on the docs homepage) — install → widget running. Primary onboarding tool; no live interactive demo, per the zero-cost budget decision in §2.1.
- Quick Start (Client Mode, written steps to follow alongside the video)
- Production Setup (Server Mode) — equally prominent, not an afterthought
- React + Next.js integration examples
- Provider integration guides (OpenAI, Gemini, Claude, Deepgram, ElevenLabs)
- Rubric & evaluation cookbook
- Security & Compliance checklist (including the §9 guardrails)
- Interview Simulator & Bias Harness walkthrough

---

## 14. Success Criteria

A developer should be able to:
1. Install the package
2. Add an API key
3. Define questions + rubric
4. Drop in `<InterviewWidget />`
5. Run the project

...and get a working AI interview — with dynamic follow-ups, semantic evaluation, rubric scoring, voice, and reports — with a clear, well-documented path to a secure, production-ready Server Mode setup.

---

## 15. Why This Wins

- **Trust-first positioning** in a space that just had a public data breach (Cluely, 83k users) — "we store nothing" is a provable claim here, not marketing copy.
- **Architecture-level security** (Server Mode) instead of a checklist of patched vulnerabilities.
- **Ecosystem, not just library** — Question Packs turn every adopter into potential distribution.
- **Ethically defensible by default** — most competitors in this space copy surveillance features without checking legality; not doing that by default reduces real legal risk for adopters and builds goodwill.
- **Testable before production** — the Simulator + Bias Harness answer the one question every developer will actually ask before adopting an LLM-graded eval system.
- **Zero infrastructure cost to maintain** — the project can run indefinitely on a domain-name budget, which means it can't be starved out by hosting bills.

---

## 16. Known Complexity Areas (worth tracking)

- LLM evaluation consistency across model versions/providers is ongoing maintenance, not a one-time build — the Bias Harness exists specifically to catch drift.
- Question Pack Marketplace needs seed content from the maintainer to solve the cold-start problem before the community contributes.
- The regulatory landscape for AI-in-hiring is actively evolving; the §9 guardrails need periodic review.
- Coding-interview execution sandboxing is a security-critical subsystem in its own right — isolate it in its own module so a vulnerability there can't compromise the rest of the SDK.

