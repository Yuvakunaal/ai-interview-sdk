# @interview-sdk/react

## 0.2.5

### Patch Changes

- 408c5a4: Fix unrelated earlier questions leaking into a later question's AI evaluation context.

  Found via a real production integration: `useInterview` was passing the _entire_ interview transcript so far as `previousTurns` context for every evaluation call, not just the current question's own follow-up history. In a longer interview this meant, by question 4 or 5, the AI was handed several unrelated prior answers (in one observed case, duplicate/off-topic text) in the same request — despite the evaluation prompt explicitly telling it to ignore earlier answers. That noise was enough to make a real provider misjudge a genuinely good, on-topic final answer as a non-answer.

  `previousTurns` is now scoped to only the current question's own turns (i.e. its own prior follow-ups) — a brand-new top-level question correctly starts with no prior context, and a follow-up still correctly sees its own question's original answer.

- b84debd: Polish the interview UI's visual details — no structural or behavioral changes, pure CSS.

  - **The "Interview progress" checklist is now an actual timeline**, not just a flat list: a connecting rail threads through it, dashed and muted for ground not yet covered, solid pass-green for a question actually answered — the line style itself carries meaning, not just its color.
  - **The live AI/candidate tiles get a soft ambient glow** while actually speaking/recording, instead of just a border-color swap — more depth and presence for whichever side currently has the floor.
  - **The plain (non-composer) answer textarea's focus state** now matches the nicer glow ring the composer variant already used, instead of a flat 2px outline — one consistent "focused input" treatment everywhere.
  - **The report's "Complete" stamp draws its checkmark in** the moment the report actually arrives, instead of appearing fully-formed and static — a small, real completion moment. Respects `prefers-reduced-motion`.

## 0.2.4

### Patch Changes

- 6353f53: Fix the transcript/feedback panel getting squeezed to a sliver in interviews with more questions.

  Found via real usage: the "Interview progress" checklist in `InterviewWidget`'s sidebar had no height cap, so its natural height grew with every question in the interview. Past roughly 4-5 questions it ate enough of the sidebar's fixed height budget that the transcript below it — where the candidate's answers and the AI's feedback actually show up — got squeezed down to a barely-visible sliver instead of scrolling properly within its own space.

  The progress checklist (and the rubric "Live signals" list below the transcript, which had the same unbounded-growth pattern) now caps its own height and scrolls internally, so neither one can crowd out the transcript regardless of how many questions or rubric dimensions are configured. The transcript reliably gets a real, generous amount of space now.

## 0.2.3

### Patch Changes

- 755bd15: Add `Question.dimensions` so a question can declare which rubric dimensions it actually assesses — fixing reports that scored a real, unrelated rubric dimension at a false 0.

  Found from a real report: a 3-dimension rubric (Technical accuracy, Communication clarity, Systems thinking) used against plain SQL syntax-recall questions ("What is a SELECT statement?"). "Systems thinking" has nothing to grade on a question like that, but it scored 0 every time anyway — dragging a candidate's weighted total from what should have been a fair score down to 6.67/100, and showing "Systems thinking: 0/100" in the report as if the candidate had failed something they were never asked about.

  - **`Question.dimensions?: string[]`** (`@interview-sdk/core`) — the subset of rubric dimension ids this question assesses. Omit for the previous, still fully-supported default (every question assesses every dimension). When set, the AI is only asked to score the listed dimensions, `totalScore` is computed from only those (re-normalized so the question can still reach 100%), and dimensions outside that set never appear in `dimensionScores` at all — not present at 0. New `scopeRubricToQuestion(rubric, question.dimensions)` export does this scoping directly if you need it.
  - **`InterviewReport.dimensionAverages`** (`@interview-sdk/react`) now only has a key for a dimension at least one question actually assessed across the whole interview — a dimension no question ever addressed is simply absent, not averaged in at a misleading 0.
  - **`ScoreSummary`** now omits the row for a dimension with no data at all, instead of rendering a demoralizing "0/100" for something the candidate was never assessed on.

  Verified end-to-end against real Groq responses reproducing the exact reported scenario: the same rubric and questions, scoped to `dimensions: ['technical', 'communication']`, now correctly omit "Systems thinking" from every score and the final report.

- Updated dependencies [755bd15]
  - @interview-sdk/core@0.2.0

## 0.2.2

### Patch Changes

- c3c1b0e: Fix two real voice-mode UX gaps found in live usage: `QuestionCard` let a candidate submit a blank answer, and the AI interviewer's tile was an unlabeled circle.

  - **"Submit answer" is now disabled for a blank/whitespace-only answer, and while recording is in progress.** A voice transcript only lands in the answer box once recording stops, so the box reads empty the whole time recording is active — previously "Submit answer" stayed clickable through that window and would silently submit a blank answer if clicked mid-recording (or any time nothing had been typed, in every mode). It now re-enables automatically once real text is present.
  - **The AI interviewer's tile now shows an "AI" identity label**, matching how the candidate's tile already shows an initial (e.g. "Y") — previously it was a bare circle with no identity mark at all until the AI actually started speaking. The label is replaced by the live speaking-amplitude meter the instant playback starts.

## 0.2.1

### Patch Changes

- Updated dependencies [51cd43c]
  - @interview-sdk/core@0.1.1

## 0.2.0

### Minor Changes

- cde77a7: Replace `ReportCard`'s "Export PDF" button with "Export Image" (PNG), and fix a critical bug in how optional export dependencies were loaded.

  - **New: Image export.** `ReportCard` can now export a PNG snapshot of the rendered report (scores, strengths/weaknesses, transcript — not the action buttons) via the optional peer dependency `html-to-image`, replacing PDF export entirely. `onExportError`'s `format` union changed from `'pdf' | 'csv'` to `'image' | 'csv'`.
  - **Critical fix: optional peer dependencies never actually loaded in a real browser.** The previous loader (used for both the old `jspdf`-based PDF export and an earlier draft of this feature) hid its `import()` call inside a `new Function(...)`-constructed string specifically so bundlers wouldn't try to resolve it at build time. That succeeded — but it also meant no bundler ever rewrote the bare specifier into something a browser can actually load, so `import('jspdf')` / `import('html-to-image')` failed with "Failed to resolve module specifier" at runtime, in every real browser, in both dev and production builds, even when the dependency was installed. Verified against a real Vite dev server, a real Vite production build, and a fully external (non-monorepo) npm consumer package.
  - The fix: a literal `import('html-to-image')` (visible to bundlers, so they can correctly resolve and lazy-chunk it when installed), `html-to-image` marked `external` in this package's own tsup build (so building `@interview-sdk/react` itself never requires the dependency to be present), and `html-to-image` declared as an optional peer dependency (`peerDependenciesMeta.optional`) so package managers wire it into this package's own resolution scope when a consumer does install it, without forcing the install otherwise. Verified end-to-end in a real browser both ways: installed → produces a real PNG; not installed → the consumer's build still succeeds and the button gracefully falls back to a JSON download, exactly as documented.

## 0.1.1

### Patch Changes

- 77ba68b: Fix two real, developer-reported bugs found in end-to-end testing:

  - **PDF export** (`@interview-sdk/react`) only ever wrote two lines ("Interview Report" + overall score) regardless of the actual report content — no dimension scores, strengths, weaknesses, missed concepts, or transcript. `generatePdfReport` now writes the full report, paginating as needed, matching what the on-screen report and CSV export already show. Verified against the real `jspdf` package, not just a mock.
  - **Dashboard's Concepts input** (bundled inside `@interview-sdk/cli`) silently erased a trailing comma the instant it was typed — parsing the input's raw text into an array and reformatting it back to a string on every keystroke meant an in-progress "word," about to type the next concept lost its comma before the next character could be typed. Copy-pasting a full comma-separated value always worked (a single onChange event, no intermediate stripped state); typing character-by-character never did. `ConceptsInput` now owns its own local raw-text state so it never fights what's being typed.

## 0.1.0

### Minor Changes

- 8af641a: Initial public release: drop-in AI-scored interview widget for React, with Client and Server modes, a dynamic follow-up engine, rubric scoring, five provider adapters with automatic failover, voice input/output, session persistence, opt-in integrity signals, Coding Interview Mode, and the Interview Simulator/Bias Harness CLI tooling.

### Patch Changes

- Updated dependencies [8af641a]
  - @interview-sdk/core@0.1.0
