# @interview-sdk/core

[![npm](https://img.shields.io/npm/v/@interview-sdk/core.svg)](https://www.npmjs.com/package/@interview-sdk/core)

Framework-independent flow, evaluation, rubric, and follow-up engine for
AI-powered interviews. This is the shared logic layer used by both
`@interview-sdk/react` (client-side / prototyping) and `@interview-sdk/server`
(production).

## Install

```bash
npm install @interview-sdk/core
```

## What lives here

- **Flow engine** (`InterviewFlowEngine`) — session state machine: start /
  pause / resume / advance, duplicate-submission prevention, session
  expiration, and `getState()`/`fromState()` for auto-save and resume after
  refresh/disconnect.
- **Evaluation engine** (`EvaluationEngine`) — calls an `AIProviderAdapter`
  for semantic (not keyword) scoring, concept coverage, contradiction
  detection across turns, and hybrid AI + answer-key scoring. Deterministic
  short-circuits (no AI call) for skipped/silent/empty answers.
- **Rubric engine** (`defineRubric`, `scoreRubric`) — developer-defined
  weighted dimensions, fails loud on empty/duplicate/invalid-weight configs,
  normalizes weights, computes a weighted total + per-dimension breakdown.
- **Follow-up engine** (`FollowUpEngine`) — dynamic generation via an
  adapter, max-depth limits, repeat-prevention (token-similarity check, no
  extra AI call), difficulty scaling, developer-defined branching (canned
  follow-ups for specific missed concepts, tried before an AI call).
- **Adapter Registry** (`AdapterRegistry`) and the `AIProviderAdapter` /
  `VoiceProviderAdapter` interfaces that `@interview-sdk/adapter-*` packages
  implement — one-line provider swaps.
- **Developer configuration validation** (`validateInterviewConfig`) — fails
  loud (collects every issue, throws once) on empty questions, missing
  rubric, invalid weights, duplicate questions, invalid webhook URLs, and
  invalid voice/language/difficulty settings. Note that `InterviewConfig`'s
  `aiProvider`/`webhook` fields are validated schema, not auto-wired: you
  still construct the actual `AIProviderAdapter` and `WebhookDispatcher`
  yourself and read those config values in your own glue code to decide how.
- A typed event emitter (`InterviewEventEmitter`) for session lifecycle
  events, so developers can pipe into their own analytics.

This package has no dependency on React, a specific AI provider, or a
specific backend framework — it's pure TypeScript, and works in both Node
and the browser.

## Security

All candidate free text is untrusted input. Every prompt this package builds
(`buildEvaluationRequest`, `buildFollowUpRequest`) carries developer-authored
content (rubric, question, concepts, answer key) in the `system` message and
candidate-provided text in its own isolated `user` message — never
string-concatenated together — to mitigate prompt injection.

## Example

```ts
import {
  InterviewFlowEngine,
  EvaluationEngine,
  FollowUpEngine,
  defineRubric,
  validateInterviewConfig,
} from '@interview-sdk/core';
import { OpenAIAdapter } from '@interview-sdk/adapter-openai';

const config = {
  questions: [
    {
      id: 'q1',
      prompt: 'Explain how a hash map works.',
      concepts: ['hashing', 'collision resolution'],
    },
  ],
  rubric: [
    { id: 'technical', label: 'Technical', weight: 3 },
    { id: 'communication', label: 'Communication', weight: 1 },
  ],
};
validateInterviewConfig(config);

const rubric = defineRubric(config.rubric);
const adapter = new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! });

const flow = new InterviewFlowEngine({ questions: config.questions });
flow.start();
flow.submitAnswer({ text: 'A hash map hashes keys into buckets.' });

const evaluation = await new EvaluationEngine().evaluate({
  question: flow.currentQuestion()!,
  rubric,
  answer: flow.getState().answers.at(-1)!,
  adapter,
});
```

Every real consumer in this SDK — `<InterviewWidget adapter={...}>`,
`ClientModeProcessor`, `ServerAnswerProcessor` — takes an `AIProviderAdapter`
instance directly like this, not through `AdapterRegistry`. Reach for
`AdapterRegistry` only if your own app needs to look adapters up by string
id at runtime (e.g. a multi-tenant app where each customer's AI provider is
chosen by data, not by your source code):

```ts
import { AdapterRegistry } from '@interview-sdk/core';

const registry = new AdapterRegistry();
registry.registerAIProvider(new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }));

const adapter = registry.getAIProvider('openai'); // then pass this to InterviewWidget/the processors as usual
```

## When a rubric dimension doesn't apply to every question

A rubric with a "Systems thinking" dimension makes sense for a design
question, but has nothing to grade on "What does a SQL `WHERE` clause do?"
— without telling the SDK that, every such question scores 0 on that
dimension, which both understates the candidate's real total and reads as
a false, demoralizing failure at something they were never actually asked.
Set `dimensions` on the question to the rubric dimension ids it actually
assesses:

```ts
const config = {
  questions: [
    {
      id: 'q1',
      prompt: 'What does a WHERE clause do?',
      concepts: ['filter', 'condition'],
      dimensions: ['technical', 'communication'], // this rubric's "systems" doesn't apply here
    },
  ],
  rubric: [
    { id: 'technical', label: 'Technical', weight: 3 },
    { id: 'communication', label: 'Communication', weight: 1 },
    { id: 'systems', label: 'Systems thinking', weight: 2 },
  ],
};
```

That question's `totalScore` is then computed from only `technical` and
`communication` (re-normalized to still reach 100%), the AI is only asked
to score those two, and `systems` never appears in that question's
`dimensionScores` at all — not present at a misleading 0. Omit `dimensions`
entirely and a question assesses every rubric dimension, exactly as
before.

See the source under `src/` — every engine ships with its own test suite
covering the product spec's edge-case list for Evaluation, Follow-Up, and
Developer Configuration.
