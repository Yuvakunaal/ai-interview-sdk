# @interview-sdk/cli

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
