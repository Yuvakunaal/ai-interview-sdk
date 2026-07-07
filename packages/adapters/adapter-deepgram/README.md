# @interview-sdk/adapter-deepgram

Deepgram voice provider adapter for `@interview-sdk/core`, built on
`@deepgram/sdk` v5. Implements both `transcribe()` (speech-to-text, the
primary use case) and `synthesize()` (Deepgram also ships TTS).

## Install

```bash
npm install @interview-sdk/core @interview-sdk/adapter-deepgram
```

## Usage

```ts
import { DeepgramAdapter } from '@interview-sdk/adapter-deepgram';

const voiceAdapter = new DeepgramAdapter({ apiKey: process.env.DEEPGRAM_API_KEY });
```

`<InterviewWidget>`'s `transcribe`/`synthesize` props are plain functions
(`(audio: Blob) => Promise<string>` / `(text: string) => Promise<SynthesisResult>`),
not a `VoiceProviderAdapter` instance — `synthesize` matches directly, but
`transcribe` needs a one-line adapter since `VoiceProviderAdapter.transcribe`
takes an `ArrayBuffer`/`Uint8Array` and returns a `TranscriptResult`:

```tsx
<InterviewWidget
  transcribe={async (audio) => (await voiceAdapter.transcribe(await audio.arrayBuffer())).text}
  synthesize={voiceAdapter.synthesize.bind(voiceAdapter)}
  // ...
/>
```

`DeepgramAdapter` accepts an optional `transcribeModel` (defaults to
`nova-3`), `speakModel` (TTS, defaults to `aura-2-thalia-en`), and an
optional pre-configured `client` for testing.

## Behavior

- `transcribe(audio)` passes the raw `ArrayBuffer`/`Uint8Array` directly to
  `listen.v1.media.transcribeFile` — no stream wrapper needed, since v5's
  `Uploadable` type accepts binary data natively — with `smart_format: true`
  for readable punctuation/casing, and reads
  `results.channels[0].alternatives[0].transcript` from the response.
- `synthesize(text)` requests `container: 'wav'` / `encoding: 'linear16'`
  explicitly so the adapter can confidently report `mimeType: 'audio/wav'`
  back to the caller, rather than guessing from Deepgram's own defaults.
- Normalizes every `DeepgramError` (a single generic class with a numeric
  `.statusCode`, not a typed hierarchy) onto the shared `Provider*Error`
  taxonomy from `@interview-sdk/core`, the same as the text-generation
  adapters.
- v5 auto-retries 429/5xx/connection errors by default (`maxRetries: 2`),
  matching Claude's and OpenAI's SDK behavior out of the box — unlike
  Gemini, no extra opt-in was needed here.

## Verified against

`@deepgram/sdk@5.5.0`, current as of 2026-07-04. **v5 is a breaking rewrite
from v4** — the client is `new DeepgramClient()` (not v4's `createClient()`),
and methods live under versioned namespaces (`listen.v1.media.transcribeFile`,
not v4's `listen.prerecorded.transcribeFile`). Re-check before assuming this
stays accurate for long.
