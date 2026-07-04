# @interview-sdk/server

Production-mode (Server Mode) evaluation, scoring, and signing. This is the
security-critical package: it's designed so the client never has write
access to the score object, AI keys never reach the browser, and webhook
payloads are HMAC-signed with idempotency keys.

> **Status:** scaffold only. Scoring/signing logic lands in Phase 5 of the
> build.

## Install

```bash
npm install @interview-sdk/core @interview-sdk/server
```

## Runs on your infra

This package runs inside _your_ backend (Express route, Next.js API route,
etc.) — there is no maintainer-hosted service behind it. See the root
Zero-Infra Guarantee.
