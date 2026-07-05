# @interview-sdk/react

React components and hooks for embedding AI-powered interviews:
`InterviewWidget`, `MicButton`, `QuestionCard`, `ReportCard`,
`TranscriptViewer`, `ScoreSummary`, and the `useInterview` hook that wires
them to `@interview-sdk/core`'s flow, evaluation, and follow-up engines.

## Install

```bash
npm install @interview-sdk/core @interview-sdk/react
```

Also install at least one AI provider adapter (e.g.
`@interview-sdk/adapter-openai`) if you're using Client Mode.

## Usage

```tsx
import { InterviewWidget } from '@interview-sdk/react';
import { OpenAIAdapter } from '@interview-sdk/adapter-openai';

const adapter = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY });

const questions = [
  {
    id: 'q1',
    prompt: 'Explain how hash maps handle collisions.',
    concepts: ['hashing', 'collisions'],
  },
  { id: 'q2', prompt: 'Walk me through how you would design a URL shortener.' },
];

const rubric = [
  { id: 'technical', label: 'Technical depth', weight: 0.6 },
  { id: 'communication', label: 'Communication', weight: 0.4 },
];

function App() {
  return (
    <InterviewWidget
      questions={questions}
      rubric={rubric}
      mode="client"
      adapter={adapter}
      onSessionEnd={(report) => console.log(report)}
    />
  );
}
```

`InterviewWidget` owns the whole flow: start screen, question-by-question
progression (including AI-generated follow-ups), pause/resume, hints, skip,
retry-on-failure, and the final `ReportCard`. If you need finer control, use
the pieces directly — `useInterview` plus `QuestionCard` /
`TranscriptViewer` / `ScoreSummary` / `ReportCard` are all exported
individually from the package root.

## Client Mode vs Server Mode

- **`mode="client"`** — the browser calls your AI provider adapter directly
  and computes scores client-side. Zero backend required, which makes it the
  fastest way to prototype, but it exposes your provider API key in the
  browser bundle and lets a motivated candidate tamper with scoring. Because
  of that, `InterviewWidget` **refuses to render in Client Mode when
  `NODE_ENV=production`**, throwing a clear error, unless you pass
  `allowClientModeInProduction` explicitly.
- **`mode="server"`** — every answer is POSTed to your own backend
  (`apiBaseUrl`, default `/api/interview/answer`) built with
  `@interview-sdk/server` (Phase 5), which holds the provider keys and does
  the scoring. This is the recommended mode for anything real.

## Voice input

Pass a `transcribe` prop (`(audio: Blob) => Promise<string>`, typically a
`VoiceProviderAdapter`'s `transcribe()`) to `InterviewWidget` or
`QuestionCard` to enable the `MicButton`. Voice input is always additive: a
text `<textarea>` is rendered regardless of whether `transcribe` is set, so
candidates can always type instead of (or in addition to) speaking.

## Accessibility

Not a stretch goal — every component here ships with:

- `aria-live="polite"` regions on the current question and hint, so screen
  readers announce updates without the user needing to re-navigate.
- A semantic `<ol role="log">` transcript and a real `<table>` (with
  `scope` on header cells) for score breakdowns — no div soup.
- A text-input fallback for every voice interaction; `MicButton` never
  renders its own error UI, since the always-present textarea is the
  fallback.
- Full keyboard operability: every control is a real `<button>` or form
  field, nothing depends on mouse-only handlers.

## Report export

`ReportCard` can export the final report as:

- **JSON** — always available, no dependencies.
- **CSV** — always available (hand-rolled transcript-to-CSV, no
  dependencies).
- **PDF** — only if you've installed the optional peer dependency
  `jspdf` yourself:

  ```bash
  npm install jspdf
  ```

  If `jspdf` isn't installed, clicking "Export PDF" falls back to a JSON
  download and calls `onExportError(error, 'pdf')` so you can surface a
  message. This package never imports `jspdf` statically — it's loaded via
  a dynamic import that's invisible to bundlers, so `jspdf` is never bundled
  or required unless a developer actually installs and uses it.

## Testing

```bash
pnpm --filter @interview-sdk/react test
pnpm --filter @interview-sdk/react test:coverage
```

Uses Vitest + `@testing-library/react` with a jsdom environment.

## Not yet implemented

- No dedicated UI for candidates to ask the interviewer questions back —
  flagged during design, deferred past Phase 4.
- Hints are a local heuristic (the question's declared `concepts`, not an
  AI-generated suggestion) — there's no extra AI call for hint generation.
