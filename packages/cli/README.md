# @interview-sdk/cli

Scaffolding, the Interview Simulator, the Bias & Consistency Testing
Harness, and question-pack tooling — all of it running locally or in your
own CI. No maintainer-hosted service is involved (Zero-Infra Guarantee).

## Install

```bash
npm install --save-dev @interview-sdk/cli
```

## `init` — scaffold a production backend route

```bash
npx interview-sdk init --framework nextjs
# or: npx interview-sdk init --framework node
```

Writes a starter route wired to `@interview-sdk/server`
(`app/api/interview/answer/route.ts` for Next.js, `interview-server.mjs`
for a standalone Node server) with a clearly-marked placeholder adapter to
fill in. Refuses to overwrite an existing file unless you pass `--force`.

## `simulate` — the Interview Simulator

```bash
npx interview-sdk simulate --config ./interview.config.mjs [--persona strong,weak] [--json]
```

Runs five scripted candidate personas — **strong**, **weak**, **off-topic**,
**silent**, and **adversarial** (a prompt-injection attempt) — through your
full question bank, including follow-ups, so you can see how your rubric
and follow-up config behave before a real candidate does. Exits non-zero if
any persona's run fails or trips a sanity warning, e.g.:

- the **strong** persona scoring unexpectedly low (rubric may be too harsh,
  or concept matching too strict)
- **weak** or **off-topic** scoring unexpectedly high (rubric may be too
  lenient)
- **adversarial** scoring suspiciously close to or above **strong** —
  a sign the AI provider may be following instructions embedded in the
  candidate's answer rather than grading it

`--config` points at a small JS/TS module whose default export is
`{ questions, rubric, adapter, maxFollowUpDepth? }`:

```js
// interview.config.mjs
import { OpenAIAdapter } from '@interview-sdk/adapter-openai';

export default {
  questions: [{ id: 'q1', prompt: 'Explain hash maps.', concepts: ['hashing'] }],
  rubric: [{ id: 'technical', label: 'Technical', weight: 1 }],
  adapter: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY }),
};
```

## `bias-harness` — the Bias & Consistency Testing Harness

```bash
npx interview-sdk bias-harness --config ./interview.config.mjs --samples ./samples.json [--runs 3] [--json]
```

Answers the question every adopter asks: "how do I know this LLM grading is
fair and consistent?" Supply a labeled sample set — real or representative
answers with an expected score range:

```json
[
  {
    "questionId": "q1",
    "answerText": "It uses buckets.",
    "expectedScoreRange": [70, 100],
    "label": "solid-answer"
  }
]
```

(JSON or YAML — same open format as question packs.) Each sample is scored
`--runs` times (default 3); the report shows the mean, standard deviation,
and whether every run landed in range. A sample fails if it's out of range
_or_ if its variance exceeds `--variance-threshold` (default 8 points) —
consistent-but-wrong and correct-but-inconsistent are both real failure
modes here.

## `pack` — question-pack tooling

```bash
npx interview-sdk pack init my-pack ./my-pack.json
npx interview-sdk pack validate ./my-pack.json
```

Question packs (§12) are an open JSON/YAML format for question sets +
rubrics + concept maps, publishable as `@interview-sdk/pack-*` npm packages.
`pack init` scaffolds a starter file; `pack validate` checks one against the
schema (duplicate ids, invalid weights, an orphaned `conceptMap` entry).

## Not yet implemented

- Personas in `simulate` are scripted, not LLM-driven — the spec allows
  either; a deterministic scripted persona is reproducible and diffable
  across rubric changes, which is why this ships first.
- `bias-harness` doesn't yet support pulling samples from a remote source —
  local JSON/YAML files only.
