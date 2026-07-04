# @interview-sdk/core

Framework-independent flow, evaluation, rubric, and follow-up engine for
AI-powered interviews. This is the shared logic layer used by both
`@interview-sdk/react` (client-side / prototyping) and `@interview-sdk/server`
(production).

> **Status:** scaffold only. The flow engine, evaluation engine, rubric
> engine, and follow-up engine land in Phase 2 of the build.

## Install

```bash
npm install @interview-sdk/core
```

## What lives here

- Flow engine (session/question state machine)
- Evaluation engine (semantic scoring, concept coverage)
- Rubric engine (weighted dimension scoring)
- Dynamic follow-up engine
- The `AIProviderAdapter` / `VoiceProviderAdapter` interfaces and the Adapter
  Registry that `@interview-sdk/adapter-*` packages implement

This package has no dependency on React, a specific AI provider, or a
specific backend framework — it's pure TypeScript.
