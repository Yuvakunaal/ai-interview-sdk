---
"@interview-sdk/cli": patch
"@interview-sdk/coding": patch
---

Fix `--version`/`--help` and the exported `*_PACKAGE_VERSION` constants always reporting `0.0.0`.

- **`@interview-sdk/cli`**: every real installed version has printed `@interview-sdk/cli@0.0.0` for both `interview-sdk --version` and `interview-sdk --help` (the banner line), since `CLI_PACKAGE_VERSION` was a hardcoded string that was never updated across any release. Verified against the real published `cli@0.1.3` package. Now read from the package's own `package.json` at runtime (the same reliable, install-location-independent resolution the `dashboard` command already uses for its bundled assets), so it can never drift again.
- **`@interview-sdk/coding`**: the exported `CODING_PACKAGE_VERSION` constant had the same hardcoded-`'0.0.0'` bug. Fixed the same way.
