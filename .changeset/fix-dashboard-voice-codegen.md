---
"@interview-sdk/cli": patch
---

Fix the dashboard's generated integration code referencing an undefined `voiceProvider` variable whenever voice ("voice" or "hybrid" runtime mode) was selected — copying the code verbatim would fail immediately with "voiceProvider is not defined". The generated `synthesize`/`transcribe` now proxy through `/api/voice/synthesize` and `/api/voice/transcribe` on the developer's own backend instead, matching the security-correct pattern already used in `packages/examples/server-mode-nextjs` (a client-constructed voice adapter would expose that key in the browser even in Server Mode). Also adds a note that these two routes need to be hand-written, since `interview-sdk init` only scaffolds the answer route.
