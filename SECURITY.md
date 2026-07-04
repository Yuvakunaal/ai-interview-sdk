# Security Policy

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report privately via [GitHub Security Advisories](../../security/advisories/new)
for this repository. If that's unavailable to you, open a regular issue asking
a maintainer to open a private channel — do not include exploit details in it.

We aim to acknowledge reports within 5 business days.

## What's In Scope

This project is a client library / server-side toolkit that developers embed
in their own applications. The AI Interview SDK maintainers do not operate any
production service, database, or API on your behalf (see the Zero-Infra
Guarantee in the README) — so most vulnerability classes that apply here are:

- Prompt-injection or untrusted-input handling bugs in `@interview-sdk/core`
  and the `adapter-*` packages
- Score-integrity / signing bugs in `@interview-sdk/server`
- Sandbox-escape bugs in `@interview-sdk/coding` (the coding-interview
  execution sandbox) — treated as critical severity
- Webhook signature verification (HMAC) or idempotency bugs
- Dependency vulnerabilities in the packages under `packages/`

Vulnerabilities in an adopting developer's own backend, database, or
infrastructure are out of scope for this repository — see
[SECURITY & COMPLIANCE docs](./packages/docs) for guidance we give developers
on securing their own deployment.

## Supported Versions

Only the latest published minor version of each `@interview-sdk/*` package
receives security fixes, in line with our semantic-versioning + changesets
release process.
