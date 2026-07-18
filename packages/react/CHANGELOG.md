# @interview-sdk/react

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
