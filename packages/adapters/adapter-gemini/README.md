# @interview-sdk/adapter-gemini

Google Gemini provider adapter for `@interview-sdk/core`, built on
`@google/genai` — Google's current unified SDK. The older
`@google/generative-ai` package reached end-of-life on 2025-11-30; this
adapter deliberately does not use it.

## Install

```bash
npm install @interview-sdk/core @interview-sdk/adapter-gemini
```

## Usage

```ts
import { GeminiAdapter } from '@interview-sdk/adapter-gemini';

const adapter = new GeminiAdapter({ apiKey: process.env.GEMINI_API_KEY });
// <InterviewWidget adapter={adapter} mode="client" ... />
// or: new ServerAnswerProcessor({ questions, rubric, adapter })
```

(`AdapterRegistry` from `@interview-sdk/core` is a separate, optional utility
for looking an adapter up by string id at runtime — most apps just pass the
adapter directly like above.)

`GeminiAdapter` accepts an optional `model` (defaults to `gemini-3.5-flash`;
pass `gemini-3.1-pro` for heavier reasoning) and an optional pre-configured
`client` for testing or Vertex/Enterprise mode.

## Behavior

- Splits `AIMessage[]` into Gemini's `config.systemInstruction` (developer
  content) and the `contents` array — Gemini uses `'user'`/`'model'` role
  names (not `'assistant'`), so `assistant` messages are mapped to `'model'`.
- Requests `responseMimeType: 'application/json'` (no `responseSchema`) when
  `responseFormat: 'json'` is set — the same reasoning as the other text
  adapters: our response shapes carry dynamic keys that Gemini's
  OpenAPI-subset schema format can't express.
- **Opts into retries explicitly.** Unlike Claude's and OpenAI's SDKs,
  `@google/genai` does not retry rate-limit/server errors by default — this
  adapter passes `httpOptions.retryOptions.attempts` so Gemini's baseline
  resilience matches the other providers before core's own `withRetry`/
  `FailoverAdapter` layer is even involved.
- Normalizes every Gemini `ApiError` (a single generic class with a numeric
  `.status`, not a typed hierarchy like Claude/OpenAI) onto the shared
  `Provider*Error` taxonomy from `@interview-sdk/core` by branching on that
  status code.
- Context-length overflow and a deprecated/retired model id both surface as
  a generic `ApiError` with no distinct type — context-length is detected
  heuristically from the message text.

## Verified against

`@google/genai@2.10.0`, current as of 2026-07-04 — model names and the SDK
package itself have changed before (Google previously shipped
`@google/generative-ai`, now EOL); re-check before assuming this stays
accurate for long.
