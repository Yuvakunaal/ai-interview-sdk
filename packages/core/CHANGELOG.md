# @interview-sdk/core

## 0.2.0

### Minor Changes

- 755bd15: Add `Question.dimensions` so a question can declare which rubric dimensions it actually assesses — fixing reports that scored a real, unrelated rubric dimension at a false 0.

  Found from a real report: a 3-dimension rubric (Technical accuracy, Communication clarity, Systems thinking) used against plain SQL syntax-recall questions ("What is a SELECT statement?"). "Systems thinking" has nothing to grade on a question like that, but it scored 0 every time anyway — dragging a candidate's weighted total from what should have been a fair score down to 6.67/100, and showing "Systems thinking: 0/100" in the report as if the candidate had failed something they were never asked about.

  - **`Question.dimensions?: string[]`** (`@interview-sdk/core`) — the subset of rubric dimension ids this question assesses. Omit for the previous, still fully-supported default (every question assesses every dimension). When set, the AI is only asked to score the listed dimensions, `totalScore` is computed from only those (re-normalized so the question can still reach 100%), and dimensions outside that set never appear in `dimensionScores` at all — not present at 0. New `scopeRubricToQuestion(rubric, question.dimensions)` export does this scoping directly if you need it.
  - **`InterviewReport.dimensionAverages`** (`@interview-sdk/react`) now only has a key for a dimension at least one question actually assessed across the whole interview — a dimension no question ever addressed is simply absent, not averaged in at a misleading 0.
  - **`ScoreSummary`** now omits the row for a dimension with no data at all, instead of rendering a demoralizing "0/100" for something the candidate was never assessed on.

  Verified end-to-end against real Groq responses reproducing the exact reported scenario: the same rubric and questions, scoped to `dimensions: ['technical', 'communication']`, now correctly omit "Systems thinking" from every score and the final report.

## 0.1.1

### Patch Changes

- 51cd43c: Fix a critical signature-verification bug in `@interview-sdk/server`, and make `@interview-sdk/core`'s evaluation-response parsing tolerant of real-world AI provider output — both found via live end-to-end testing against real AI providers, not just mocks.

  - **Critical: `verify()` rejected genuinely untampered evaluations.** `EvaluationResult`'s optional fields (`rationale`, `matchesAnswerKey`, `conceptCoverage[].partial`) are built via plain object-literal assignment (e.g. `rationale: parsed.rationale`), so they're present as an explicit `key: undefined` even when the AI provider's response omitted that field — unlike a key that was never set at all. `canonicalize()` (used by both `sign()` and `verify()`) treated these two cases differently, but every real signed payload survives a JSON round-trip on its way from `/api/interview/answer` to the browser and back to `/api/interview/complete` — and JSON has no `undefined`, so that key is simply gone on the other side. The result: any real session where the AI didn't return every optional field (common, and confirmed against a real Groq response) failed signature verification and was treated as tampered, even though nothing had touched it. `canonicalize()` now skips `undefined`-valued keys entirely, matching `JSON.stringify`'s own behavior. Verified against a real running Next.js server, a real Groq-backed evaluation, and the real `/api/interview/complete` re-verification route.
  - **`@interview-sdk/core`'s evaluation schema was too strict for real (especially smaller/faster) models.** Verified against dozens of real Groq (`llama-3.1-8b-instant`) responses via the CLI's `simulate` command: models commonly return `null` for an unset optional field instead of omitting it, a bare value instead of a one-item array, or an occasional hallucinated flag that isn't a real enum member — every one of these previously threw `MalformedAdapterResponseError` and discarded an otherwise-valid evaluation over an auxiliary field, not the dimension scores that actually drive the candidate's score. `contradictions`, `flags`, and `conceptCoverage` now tolerate `null`/bare-value shapes (coerced to the intended array), `matchesAnswerKey`/`rationale`/`conceptCoverage[].partial` treat a real `null` the same as omitted, a `conceptCoverage` entry with no real `concept` name is dropped (there's no safe value to invent), and an unrecognized/hallucinated flag value is dropped rather than failing the whole response.

## 0.1.0

### Minor Changes

- 8af641a: Initial public release: drop-in AI-scored interview widget for React, with Client and Server modes, a dynamic follow-up engine, rubric scoring, five provider adapters with automatic failover, voice input/output, session persistence, opt-in integrity signals, Coding Interview Mode, and the Interview Simulator/Bias Harness CLI tooling.
