# AI Interview SDK

[![CI](https://github.com/Yuvakunaal/ai-interview-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Yuvakunaal/ai-interview-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Open-source infrastructure for embedding AI-scored interviews into your own
product — your API keys, your backend, your database. The maintainers never
see, store, or process a single candidate's answer.

This is a trust story as much as a code library: in a space that's had a
public data breach, "we store nothing, and we can prove it architecturally"
is a real claim here, not a line of marketing copy. See the
[Zero-Infra Guarantee](#zero-infra-guarantee) below for what backs it.

```tsx
import { InterviewWidget } from '@interview-sdk/react';
import { OpenAIAdapter } from '@interview-sdk/adapter-openai';

<InterviewWidget
  questions={[
    {
      id: 'q1',
      prompt: 'Explain how hash maps handle collisions.',
      concepts: ['hashing', 'collisions'],
    },
  ]}
  rubric={[{ id: 'technical', label: 'Technical depth', weight: 1 }]}
  mode="client"
  adapter={new OpenAIAdapter({ apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY })}
/>;
```

That's a full interview — dynamic follow-ups, semantic evaluation, rubric
scoring, voice input, and a report — in prototyping (Client) Mode. Swap
`mode="client"` + `adapter` for `mode="server"` + `apiBaseUrl` and the exact
same widget talks to your own backend instead, where the AI key actually
belongs. The docs site isn't deployed anywhere yet — run it locally
(`pnpm --filter @interview-sdk/docs dev`, then open `/quick-start`), or go
straight to a working example: [`packages/examples/server-mode-nextjs`](./packages/examples/server-mode-nextjs)
(production path) or [`packages/examples/basic-demo`](./packages/examples/basic-demo)
(prototyping path) — both run with zero setup.

> **Status:** the initial 9-phase build (see [Build Status](#build-status))
> is complete — every package below is implemented and tested. Nothing has
> been published to npm yet (every package is still at `0.0.0`), so treat
> this as a pre-release snapshot, not an installable release. See
> [EDGE_CASES.md](./EDGE_CASES.md) for an honest, line-by-line audit of what
> is and isn't covered — it names real gaps, not just what shipped.

## What this is — and isn't

- **The SDK is:** a developer tool you install into your own app.
- **The SDK is not:** an interview platform, a SaaS product, or a data
  controller. The maintainers never see, store, or process candidate data.

## Zero-Infra Guarantee

The maintainers never pay for backend compute or storage — not at 10 users,
not at 10,000. `@interview-sdk/server` runs on _your_ infrastructure. The
Interview Simulator and Bias Testing Harness run locally or in _your_ CI. The
only maintainer spend is the domain name. See [CONTRIBUTING.md](./CONTRIBUTING.md)
for what this means for anyone proposing a new feature.

## Packages

| Package                                                                       | Description                                                |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`@interview-sdk/core`](./packages/core)                                      | Flow, evaluation, rubric, and follow-up engine             |
| [`@interview-sdk/react`](./packages/react)                                    | React components and hooks                                 |
| [`@interview-sdk/server`](./packages/server)                                  | Production-mode scoring and key isolation                  |
| [`@interview-sdk/coding`](./packages/coding)                                  | Sandboxed code execution for Coding Interview Mode         |
| [`@interview-sdk/cli`](./packages/cli)                                        | Scaffolding, Interview Simulator, Bias Harness             |
| [`@interview-sdk/adapter-openai`](./packages/adapters/adapter-openai)         | OpenAI provider adapter                                    |
| [`@interview-sdk/adapter-claude`](./packages/adapters/adapter-claude)         | Anthropic Claude provider adapter                          |
| [`@interview-sdk/adapter-gemini`](./packages/adapters/adapter-gemini)         | Google Gemini provider adapter                             |
| [`@interview-sdk/adapter-deepgram`](./packages/adapters/adapter-deepgram)     | Deepgram voice provider adapter                            |
| [`@interview-sdk/adapter-elevenlabs`](./packages/adapters/adapter-elevenlabs) | ElevenLabs voice provider adapter                          |
| [`docs`](./packages/docs)                                                     | Documentation site (static Next.js export)                 |
| [`examples/server-mode-nextjs`](./packages/examples/server-mode-nextjs)       | Runnable Server Mode example (Next.js)                     |
| [`examples/basic-demo`](./packages/examples/basic-demo)                       | Runnable Client Mode demo (Vite), mock adapter, no API key |

## Docs & examples

- **[Documentation site](./packages/docs)** — Quick Start, Production Setup,
  provider guides, a rubric/evaluation cookbook, security & compliance,
  and the Interview Simulator/Bias Harness walkthrough.
  `pnpm --filter @interview-sdk/docs dev` to run it locally.
- **[`examples/server-mode-nextjs`](./packages/examples/server-mode-nextjs)**
  — the production path: `<InterviewWidget mode="server" />` talking to a
  real `@interview-sdk/server` route. Runs with zero setup (mock adapter by
  default).
- **[`examples/basic-demo`](./packages/examples/basic-demo)** — the
  prototyping path: Client Mode in the browser, also zero setup.

## Architecture

```
Developer App (React)
        │
        ▼
@interview-sdk/react   ← UI components, hooks
        │
        ▼
@interview-sdk/core    ← flow logic, evaluation, rubric, follow-up engine
        │
        ├──► Client Mode (prototyping): calls AI provider directly from browser
        │
        └──► Server Mode (production, recommended):
                    ▼
             @interview-sdk/server  ← runs in developer's backend
                    │
                    ▼
             Developer's DB + Auth + Storage
```

## Build Status

This repo was built in phases, each shipped as its own reviewed increment.
That history is kept here deliberately — it's a more honest record than a
single squashed "initial commit" would be.

- [x] Phase 0 — Plan
- [x] Phase 1 — Repo scaffolding (this state)
- [x] Phase 2 — `@interview-sdk/core`
- [x] Phase 3 — Adapters
- [x] Phase 4 — `@interview-sdk/react`
- [x] Phase 5 — `@interview-sdk/server`
- [x] Phase 6 — `@interview-sdk/cli`
- [x] Phase 7 — Coding Interview Mode
- [x] Phase 8 — Docs site + examples
- [x] Phase 9 — Final pass (edge-case coverage table, guardrail re-verification, README polish)

The initial build is complete. See [EDGE_CASES.md](./EDGE_CASES.md) for what
that does and doesn't cover in practice, and [CONTRIBUTING.md](./CONTRIBUTING.md)
for what comes next.

## Development

Requires Node >= 18.18 and pnpm (`corepack enable`).

```bash
pnpm install
pnpm build          # build all packages (tsup)
pnpm test           # run all unit tests (vitest)
pnpm test:coverage  # run tests with coverage
pnpm lint           # eslint across all packages
pnpm typecheck      # tsc --noEmit across all packages
pnpm format         # prettier --write
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full contributor workflow,
including changesets.

## Security

See [SECURITY.md](./SECURITY.md) to report a vulnerability, and
[EDGE_CASES.md](./EDGE_CASES.md) for exactly which security guarantees this
SDK provides architecturally versus which ones are your own infrastructure's
responsibility.

## License

[MIT](./LICENSE)
