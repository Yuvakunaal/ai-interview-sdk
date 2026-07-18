# @interview-sdk/cli

## 0.1.4

### Patch Changes

- b9ad306: Fix `--version`/`--help` and the exported `*_PACKAGE_VERSION` constants always reporting `0.0.0`.

  - **`@interview-sdk/cli`**: every real installed version has printed `@interview-sdk/cli@0.0.0` for both `interview-sdk --version` and `interview-sdk --help` (the banner line), since `CLI_PACKAGE_VERSION` was a hardcoded string that was never updated across any release. Verified against the real published `cli@0.1.3` package. Now read from the package's own `package.json` at runtime (the same reliable, install-location-independent resolution the `dashboard` command already uses for its bundled assets), so it can never drift again.
  - **`@interview-sdk/coding`**: the exported `CODING_PACKAGE_VERSION` constant had the same hardcoded-`'0.0.0'` bug. Fixed the same way.

## 0.1.3

### Patch Changes

- 77ba68b: Fix two real, developer-reported bugs found in end-to-end testing:

  - **PDF export** (`@interview-sdk/react`) only ever wrote two lines ("Interview Report" + overall score) regardless of the actual report content — no dimension scores, strengths, weaknesses, missed concepts, or transcript. `generatePdfReport` now writes the full report, paginating as needed, matching what the on-screen report and CSV export already show. Verified against the real `jspdf` package, not just a mock.
  - **Dashboard's Concepts input** (bundled inside `@interview-sdk/cli`) silently erased a trailing comma the instant it was typed — parsing the input's raw text into an array and reformatting it back to a string on every keystroke meant an in-progress "word," about to type the next concept lost its comma before the next character could be typed. Copy-pasting a full comma-separated value always worked (a single onChange event, no intermediate stripped state); typing character-by-character never did. `ConceptsInput` now owns its own local raw-text state so it never fights what's being typed.

## 0.1.2

### Patch Changes

- bb46aee: Fix the dashboard's generated integration code referencing an undefined `voiceProvider` variable whenever voice ("voice" or "hybrid" runtime mode) was selected — copying the code verbatim would fail immediately with "voiceProvider is not defined". The generated `synthesize`/`transcribe` now proxy through `/api/voice/synthesize` and `/api/voice/transcribe` on the developer's own backend instead, matching the security-correct pattern already used in `packages/examples/server-mode-nextjs` (a client-constructed voice adapter would expose that key in the browser even in Server Mode). Also adds a note that these two routes need to be hand-written, since `interview-sdk init` only scaffolds the answer route.

## 0.1.1

### Patch Changes

- 88a2845: Fix every CLI command (`dashboard`, `init`, `simulate`, `bias-harness`, `pack`) silently doing nothing when run via `npx interview-sdk` or a locally-installed `interview-sdk` binary — the only ways a real user ever invokes it. The entry-point guard compared `import.meta.url` (which Node resolves through symlinks) against the raw, unresolved `process.argv[1]` (which stays the symlink path npm/npx always invoke through), so they never matched outside a direct `node dist/cli.js` call.

## 0.1.0

### Minor Changes

- 8af641a: Initial public release: drop-in AI-scored interview widget for React, with Client and Server modes, a dynamic follow-up engine, rubric scoring, five provider adapters with automatic failover, voice input/output, session persistence, opt-in integrity signals, Coding Interview Mode, and the Interview Simulator/Bias Harness CLI tooling.

### Patch Changes

- Updated dependencies [8af641a]
  - @interview-sdk/core@0.1.0
