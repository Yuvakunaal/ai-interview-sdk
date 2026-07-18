# @interview-sdk/react

[![npm](https://img.shields.io/npm/v/@interview-sdk/react.svg)](https://www.npmjs.com/package/@interview-sdk/react)

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

// Client Mode ships the key to the browser — it needs the NEXT_PUBLIC_/VITE_
// prefix your bundler uses to expose an env var client-side. Use Server Mode
// (see @interview-sdk/server) for production instead.
const adapter = new OpenAIAdapter({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY });

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

## Styling

Every component renders plain semantic HTML with stable `isdk-*`
classNames and nothing else. Importing CSS is entirely optional:

```ts
import '@interview-sdk/react/styles.css';
```

- **Skip the import** for a fully headless build — style the `isdk-*`
  classNames yourself, or ignore them and target the underlying tags/roles
  (`section`, `button[type="submit"]`, `[role="alert"]`, etc.), same as in
  earlier versions of this package.
- **Import it** to get a complete, presentable interface with zero extra
  work — the same design system as the project's own landing page: a warm
  paper background, a serif display face for headings, monospace for
  labels and scores, hairline-rule cards, and pass/flag/neutral score
  chips (reusing the same 75/40 cutoffs `buildReport` already uses for
  strengths/weaknesses, so a score reads the same color everywhere).
- **Reskin it** by overriding the CSS custom properties it defines on
  `:root` (`--isdk-accent`, `--isdk-paper`, `--isdk-radius`,
  `--isdk-font-display`, etc. — see `styles.css` for the full list) in
  your own stylesheet loaded after it, or override the `isdk-*` classes
  directly for full control. It also respects `prefers-color-scheme: dark`
  out of the box.

Nothing here depends on the stylesheet being present — `InterviewWidget`
and every sub-component work identically with or without it.

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

## Voice

Voice is two independent, both-optional props — set either, both, or
neither:

- **Input** — pass `transcribe` (`(audio: Blob) => Promise<string>`) to
  enable the `MicButton`. Always additive: a text `<textarea>` is rendered
  regardless of whether `transcribe` is set, so candidates can always type
  instead of (or in addition to) speaking.
- **Output** — pass `synthesize` (`(text: string) => Promise<SynthesisResult>`)
  to speak each question and follow-up aloud via `QuestionAudio`. It
  autoplays once audio is ready; if the browser blocks autoplay (no prior
  user gesture in the tab), it falls back to a "Play question" button
  instead of failing silently. Also additive — the prompt is always
  rendered as text regardless of whether `synthesize` is set.

Both props are typically backed by a `VoiceProviderAdapter` from an
`@interview-sdk/adapter-*` voice package, but the shapes aren't identical:
`synthesize` matches `VoiceProviderAdapter.synthesize` exactly, while
`transcribe` needs a one-line adapter, since `VoiceProviderAdapter.transcribe`
takes an `ArrayBuffer`/`Uint8Array` and returns a `TranscriptResult`, not a
`Blob`/`string`:

```tsx
<InterviewWidget
  transcribe={async (audio) => (await voiceAdapter.transcribe(await audio.arrayBuffer())).text}
  synthesize={voiceAdapter.synthesize.bind(voiceAdapter)}
  // ...
/>
```

Set both for a genuine voice-to-voice interview: the question is spoken,
the candidate answers by speaking, and the transcript still shows every
word for anyone reading instead of listening.

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
- **Image (PNG)** — a snapshot of the rendered report card (scores,
  strengths/weaknesses, transcript — not the action buttons themselves),
  only if you've installed the optional peer dependency `html-to-image`
  yourself:

  ```bash
  npm install html-to-image
  ```

  If `html-to-image` isn't installed, clicking "Export Image" falls back
  to a JSON download and calls `onExportError(error, 'image')` so you can
  surface a message. This package never imports `html-to-image`
  statically — it's loaded via a dynamic import that's invisible to
  bundlers, so it's never bundled or required unless a developer actually
  installs and uses it.

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
