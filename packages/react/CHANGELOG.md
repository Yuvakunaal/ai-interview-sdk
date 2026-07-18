# @interview-sdk/react

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
