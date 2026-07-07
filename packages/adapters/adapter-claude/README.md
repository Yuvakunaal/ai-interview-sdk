# @interview-sdk/adapter-claude

Anthropic Claude provider adapter for `@interview-sdk/core`, built on the
official `@anthropic-ai/sdk` (Messages API).

## Install

```bash
npm install @interview-sdk/core @interview-sdk/adapter-claude
```

## Usage

```ts
import { ClaudeAdapter } from '@interview-sdk/adapter-claude';

const adapter = new ClaudeAdapter({ apiKey: process.env.ANTHROPIC_API_KEY });
// <InterviewWidget adapter={adapter} mode="client" ... />
// or: new ServerAnswerProcessor({ questions, rubric, adapter })
```

(`AdapterRegistry` from `@interview-sdk/core` is a separate, optional utility
for looking an adapter up by string id at runtime — most apps just pass the
adapter directly like above.)

`ClaudeAdapter` accepts an optional `model` (defaults to `claude-opus-4-8`)
and an optional pre-configured `client` — useful for testing or for pointing
at Claude Platform on AWS / Bedrock / Vertex / Foundry client classes instead
of the first-party client.

## Behavior

- Splits `AIMessage[]` into Anthropic's `system` string param and the
  `messages` array (`user`/`assistant` only) — matches the security model in
  `@interview-sdk/core`, where candidate free text always arrives as its own
  `user`-role message.
- Treats a `stop_reason: "refusal"` (Claude's safety-classifier decline) as
  an error rather than silently returning empty content.
- Normalizes every Anthropic SDK exception onto the shared `Provider*Error`
  taxonomy exported by `@interview-sdk/core` (`ProviderAuthError`,
  `ProviderRateLimitError`, `ProviderOverloadedError`,
  `ProviderConnectionError`, `ProviderTimeoutError`,
  `ProviderContextLengthExceededError`, `ProviderInvalidRequestError`), so
  `withRetry` and `FailoverAdapter` from core work without knowing anything
  Claude-specific.
- Context-length overflow is detected heuristically from the error message
  text, since Anthropic reports it as a plain 400 `invalid_request_error`
  with no distinct error type.
- A deprecated/unknown model id surfaces as Anthropic's 404 `NotFoundError`
  and is normalized to `ProviderInvalidRequestError` — pair this adapter with
  `FailoverAdapter` if you want automatic fallback to another provider.

## Verified against

`@anthropic-ai/sdk@0.110.0`, current as of 2026-07-04 — the Messages API,
model catalog, and error taxonomy shift quickly; re-check before assuming
this stays accurate for long.
