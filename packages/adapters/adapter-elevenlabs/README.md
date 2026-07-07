# @interview-sdk/adapter-elevenlabs

ElevenLabs voice provider adapter for `@interview-sdk/core`, built on
`@elevenlabs/elevenlabs-js` — the current package (the unscoped `elevenlabs`
package is deprecated and has moved here). Implements both `synthesize()`
(text-to-speech, the primary use case) and `transcribe()` (ElevenLabs also
ships speech-to-text).

## Install

```bash
npm install @interview-sdk/core @interview-sdk/adapter-elevenlabs
```

## Usage

```ts
import { ElevenLabsAdapter } from '@interview-sdk/adapter-elevenlabs';

const voiceAdapter = new ElevenLabsAdapter({ apiKey: process.env.ELEVENLABS_API_KEY });
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

`ElevenLabsAdapter` accepts an optional `voiceId` (defaults to ElevenLabs'
prebuilt "Rachel" voice), `speakModel` (TTS, defaults to `eleven_multilingual_v2`),
`transcribeModel` (STT, defaults to `scribe_v2`), and an optional
pre-configured `client` for testing.

## Behavior

- `synthesize(text)` requests `outputFormat: 'mp3_44100_128'` explicitly (so
  the adapter can confidently report `mimeType: 'audio/mpeg'`) and drains the
  SDK's `ReadableStream<Uint8Array>` response into a single `ArrayBuffer`.
- `transcribe(audio)` passes the raw `ArrayBuffer`/`Uint8Array` directly to
  `speechToText.convert` — no stream wrapper needed, the SDK's `Uploadable`
  type accepts binary data natively.
- Normalizes every `ElevenLabsError` (a base class with a numeric
  `.statusCode`; typed subclasses exist per status but this adapter branches
  on the code directly, matching the Deepgram adapter's pattern) onto the
  shared `Provider*Error` taxonomy from `@interview-sdk/core`.
- Auto-retries 408/409/429/5xx by default (`maxRetries: 2`), matching
  Claude's and OpenAI's SDK behavior out of the box.

## Verified against

`@elevenlabs/elevenlabs-js@2.56.0`, current as of 2026-07-04 — the package
itself was renamed from unscoped `elevenlabs`; model names and output
formats shift quickly. Re-check before assuming this stays accurate for
long.
