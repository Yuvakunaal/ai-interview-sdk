---
"@interview-sdk/cli": patch
---

Fix every CLI command (`dashboard`, `init`, `simulate`, `bias-harness`, `pack`) silently doing nothing when run via `npx interview-sdk` or a locally-installed `interview-sdk` binary — the only ways a real user ever invokes it. The entry-point guard compared `import.meta.url` (which Node resolves through symlinks) against the raw, unresolved `process.argv[1]` (which stays the symlink path npm/npx always invoke through), so they never matched outside a direct `node dist/cli.js` call.
