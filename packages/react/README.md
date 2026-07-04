# @interview-sdk/react

React components and hooks for embedding AI-powered interviews.

> **Status:** scaffold only. Components land in Phase 4 of the build.

## Install

```bash
npm install @interview-sdk/core @interview-sdk/react
```

## What lives here

- `InterviewWidget` — the top-level orchestrating component
- `MicButton`, `QuestionCard`, `ReportCard`, `TranscriptViewer`, `ScoreSummary`
- Hooks wrapping `@interview-sdk/core`'s flow/evaluation engines

## Client Mode vs Server Mode

Components in this package can run in **Client Mode** (calls your AI provider
directly from the browser — prototyping only) or **Server Mode** (delegates
evaluation/scoring to your `@interview-sdk/server` backend — production).
Client Mode refuses to run under `NODE_ENV=production` without an explicit
override flag, since it exposes API keys and lets scores be tampered with
client-side.

## Accessibility

Captions, a text-only fallback mode, screen-reader-friendly markup, and full
keyboard navigation are requirements for every component here, not stretch
goals.
