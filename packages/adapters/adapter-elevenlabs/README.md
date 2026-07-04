# @interview-sdk/adapter-elevenlabs

ElevenLabs voice (text-to-speech) provider adapter for @interview-sdk/core.

> **Status:** scaffold only. Real implementation lands in Phase 3 of the
> build, against the current provider SDK/docs (verified then, not assumed
> from memory).

## Install

```bash
npm install @interview-sdk/core @interview-sdk/adapter-elevenlabs
```

This package implements the `AIProviderAdapter` / `VoiceProviderAdapter`
interface from `@interview-sdk/core` and registers itself with the Adapter
Registry, so it's a one-line config swap for any other adapter.
