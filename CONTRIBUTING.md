# Contributing to AI Interview SDK

Thanks for taking the time to contribute. This is a monorepo managed with
pnpm workspaces + Turborepo.

## Prerequisites

- Node.js >= 20.19
- pnpm (run `corepack enable` to get the version pinned in `package.json`)

## Getting Started

```bash
git clone https://github.com/Yuvakunaal/ai-interview-sdk.git
cd ai-interview-sdk
pnpm install
pnpm build
pnpm test
```

## Monorepo Layout

```
packages/
├── core/                 @interview-sdk/core
├── react/                @interview-sdk/react
├── server/                @interview-sdk/server
├── coding/               @interview-sdk/coding
├── cli/                  @interview-sdk/cli
├── dashboard/            @interview-sdk/dashboard (internal, unpublished)
├── adapters/
│   ├── adapter-openai/
│   ├── adapter-claude/
│   ├── adapter-gemini/
│   ├── adapter-deepgram/
│   └── adapter-elevenlabs/
├── examples/
├── docs/                 documentation site
└── landing/              @interview-sdk/landing
```

## Common Commands

Run from the repo root — Turborepo fans these out to every package:

```bash
pnpm build          # build all packages
pnpm test           # run all unit tests
pnpm test:coverage  # run tests with coverage
pnpm lint           # lint all packages
pnpm typecheck      # tsc --noEmit across all packages
pnpm format         # prettier --write
```

Scope any command to a single package with pnpm's `--filter`:

```bash
pnpm --filter @interview-sdk/core test
```

## Making Changes

1. Create a branch off `main`.
2. Make your change, with tests. New behavior needs a test that would fail
   without the change — see `packages/*/src/**/*.test.ts` for existing
   patterns.
3. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` before opening
   a PR — CI runs the same four checks on Node 20/22.
4. Add a changeset: `pnpm changeset`. Pick the affected package(s) and a
   semver bump (patch/minor/major) and describe the change from a consumer's
   point of view — this text becomes the changelog entry.
5. Open a PR against `main`.

## Code Style

- TypeScript strict mode. No `any` without an inline comment justifying why
  (the linter enforces this).
- Prefer explicit, boring code over clever abstractions — this SDK is
  infrastructure other people's hiring pipelines depend on.
- All candidate-supplied free text must be treated as untrusted input and
  passed into AI prompts via structured message roles, never string
  concatenation (see the Security Model in the docs).
- New packages follow the existing skeleton: `tsup` build, `vitest` tests,
  a typed public API re-exported from `src/index.ts`, and their own README.

## Reporting Bugs / Requesting Features

Use the issue templates. For security vulnerabilities, see
[SECURITY.md](./SECURITY.md) instead of opening a public issue.
