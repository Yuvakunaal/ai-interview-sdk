# @interview-sdk/cli

Scaffolding, Interview Simulator, and Bias & Consistency Testing Harness.

> **Status:** scaffold only. Commands land in Phase 6 of the build.

## Install

```bash
npx @interview-sdk/cli init --mode=server
```

## Planned commands

- `init --mode=server` — scaffolds a minimal backend route using
  `@interview-sdk/server`
- `simulate` — Interview Simulator: headless scripted "fake candidate"
  personas (strong, weak, off-topic, silent, adversarial/prompt-injection)
  validate rubric and follow-up behavior before a real candidate sees it
- `bias-harness` — runs a labeled sample set against your rubric + AI
  provider and reports scoring variance/consistency

All of the above run locally or in your own CI — no maintainer-hosted
service is involved (Zero-Infra Guarantee).
