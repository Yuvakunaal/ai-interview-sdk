# AI Interview SDK

Open-source TypeScript/React infrastructure for embedding AI-powered
interviews into any application — with your own AI keys, backend, and
database.

> **Status:** mid-build (through Phase 4). `@interview-sdk/core` (flow,
> evaluation, rubric, follow-up engines), all 5 provider adapters
> (OpenAI, Claude, Gemini, Deepgram, ElevenLabs), and `@interview-sdk/react`
> (`InterviewWidget`, `MicButton`, `QuestionCard`, `ReportCard`,
> `TranscriptViewer`, `ScoreSummary`) are implemented and tested — see
> [Build Status](#build-status) below. `server`, `cli`, and `coding` are
> still scaffold-only. This README will get its full public-facing pass
> (badges, quick start, positioning) once the SDK actually works
> end-to-end.

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

| Package                                                                       | Description                                        |
| ----------------------------------------------------------------------------- | -------------------------------------------------- |
| [`@interview-sdk/core`](./packages/core)                                      | Flow, evaluation, rubric, and follow-up engine     |
| [`@interview-sdk/react`](./packages/react)                                    | React components and hooks                         |
| [`@interview-sdk/server`](./packages/server)                                  | Production-mode scoring and key isolation          |
| [`@interview-sdk/coding`](./packages/coding)                                  | Sandboxed code execution for Coding Interview Mode |
| [`@interview-sdk/cli`](./packages/cli)                                        | Scaffolding, Interview Simulator, Bias Harness     |
| [`@interview-sdk/adapter-openai`](./packages/adapters/adapter-openai)         | OpenAI provider adapter                            |
| [`@interview-sdk/adapter-claude`](./packages/adapters/adapter-claude)         | Anthropic Claude provider adapter                  |
| [`@interview-sdk/adapter-gemini`](./packages/adapters/adapter-gemini)         | Google Gemini provider adapter                     |
| [`@interview-sdk/adapter-deepgram`](./packages/adapters/adapter-deepgram)     | Deepgram voice provider adapter                    |
| [`@interview-sdk/adapter-elevenlabs`](./packages/adapters/adapter-elevenlabs) | ElevenLabs voice provider adapter                  |

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

This repo is being built in phases; each phase ships as its own reviewed
increment:

- [x] Phase 0 — Plan
- [x] Phase 1 — Repo scaffolding (this state)
- [x] Phase 2 — `@interview-sdk/core`
- [x] Phase 3 — Adapters
- [x] Phase 4 — `@interview-sdk/react`
- [ ] Phase 5 — `@interview-sdk/server`
- [ ] Phase 6 — `@interview-sdk/cli`
- [ ] Phase 7 — Coding Interview Mode
- [ ] Phase 8 — Docs site + examples
- [ ] Phase 9 — Final pass (edge-case coverage table, guardrail re-verification, README polish)

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

See [SECURITY.md](./SECURITY.md) to report a vulnerability.

## License

[MIT](./LICENSE)
