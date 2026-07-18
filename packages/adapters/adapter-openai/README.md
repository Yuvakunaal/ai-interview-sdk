# @interview-sdk/adapter-openai

[![npm](https://img.shields.io/npm/v/@interview-sdk/adapter-openai.svg)](https://www.npmjs.com/package/@interview-sdk/adapter-openai)

OpenAI provider adapter for `@interview-sdk/core`, built on the official
`openai` SDK's **Responses API** (`client.responses.create`) — OpenAI's
current recommended interface, though the older Chat Completions API remains
fully supported indefinitely if you need it instead.

## Install

```bash
npm install @interview-sdk/core @interview-sdk/adapter-openai
```

## Usage

```ts
import { OpenAIAdapter } from '@interview-sdk/adapter-openai';

const adapter = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY });
// <InterviewWidget adapter={adapter} mode="client" ... />
// or: new ServerAnswerProcessor({ questions, rubric, adapter })
```

(`AdapterRegistry` from `@interview-sdk/core` is a separate, optional utility
for looking an adapter up by string id at runtime — most apps just pass the
adapter directly like above.)

`OpenAIAdapter` accepts an optional `model` (defaults to `gpt-5.4-mini` — a
cost-effective choice for structured scoring tasks; pass `gpt-5.5` for the
frontier model) and an optional pre-configured `client` for testing or custom
base URLs.

## Behavior

- Maps `AIMessage[]` directly onto the Responses API's `input` array —
  `system`/`user`/`assistant` roles all map 1:1.
- Requests `text: { format: { type: 'json_object' } }` when
  `responseFormat: 'json'` is set. Deliberately **not** `json_schema` (OpenAI's
  stricter, preferred structured-output mode): core's evaluation/follow-up
  response shapes carry dynamic keys (developer-defined rubric dimension
  ids), which a fixed JSON Schema can't express.
- Normalizes every OpenAI SDK exception onto the shared `Provider*Error`
  taxonomy exported by `@interview-sdk/core`, the same as every other
  adapter, so `withRetry` and `FailoverAdapter` work without any
  OpenAI-specific knowledge.
- Context-length overflow and a deprecated/retired model id both surface as
  plain 4xx errors from OpenAI with no distinct error type — context-length
  is detected heuristically from the message text; a missing/retired model
  normalizes to `ProviderInvalidRequestError`.

## Verified against

`openai@6.45.0`, current as of 2026-07-04 — model names, the Responses vs.
Chat Completions guidance, and the error taxonomy shift quickly; re-check
before assuming this stays accurate for long.
