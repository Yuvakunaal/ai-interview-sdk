# @interview-sdk/coding

## 0.1.3

### Patch Changes

- Updated dependencies [755bd15]
  - @interview-sdk/core@0.2.0

## 0.1.2

### Patch Changes

- Updated dependencies [51cd43c]
  - @interview-sdk/core@0.1.1

## 0.1.1

### Patch Changes

- b9ad306: Fix `--version`/`--help` and the exported `*_PACKAGE_VERSION` constants always reporting `0.0.0`.

  - **`@interview-sdk/cli`**: every real installed version has printed `@interview-sdk/cli@0.0.0` for both `interview-sdk --version` and `interview-sdk --help` (the banner line), since `CLI_PACKAGE_VERSION` was a hardcoded string that was never updated across any release. Verified against the real published `cli@0.1.3` package. Now read from the package's own `package.json` at runtime (the same reliable, install-location-independent resolution the `dashboard` command already uses for its bundled assets), so it can never drift again.
  - **`@interview-sdk/coding`**: the exported `CODING_PACKAGE_VERSION` constant had the same hardcoded-`'0.0.0'` bug. Fixed the same way.

## 0.1.0

### Minor Changes

- 8af641a: Initial public release: drop-in AI-scored interview widget for React, with Client and Server modes, a dynamic follow-up engine, rubric scoring, five provider adapters with automatic failover, voice input/output, session persistence, opt-in integrity signals, Coding Interview Mode, and the Interview Simulator/Bias Harness CLI tooling.

### Patch Changes

- Updated dependencies [8af641a]
  - @interview-sdk/core@0.1.0
