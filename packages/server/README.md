# @interview-sdk/server

[![npm](https://img.shields.io/npm/v/@interview-sdk/server.svg)](https://www.npmjs.com/package/@interview-sdk/server)

Production-mode (Server Mode) evaluation, scoring, and signing. This is the
security-critical package: AI keys never reach the browser, the score is
computed against your own server-side question bank and rubric (never the
client's copy), and it ships HMAC signing for both scores and webhooks.

## Install

```bash
npm install @interview-sdk/core @interview-sdk/server
```

Also install an AI provider adapter (e.g. `@interview-sdk/adapter-openai`).

## Runs on your infra

This package runs inside _your_ backend — there is no maintainer-hosted
service behind it. See the root Zero-Infra Guarantee.

## Usage (Next.js Route Handler)

```ts
// app/api/interview/answer/route.ts
import { ServerAnswerProcessor, createInterviewAnswerHandler } from '@interview-sdk/server';
import { OpenAIAdapter } from '@interview-sdk/adapter-openai';

const processor = new ServerAnswerProcessor({
  questions: [
    {
      id: 'q1',
      prompt: 'Explain how hash maps handle collisions.',
      concepts: ['hashing', 'collisions'],
    },
  ],
  rubric: [{ id: 'technical', label: 'Technical depth', weight: 1 }],
  adapter: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
  signingSecret: process.env.INTERVIEW_SIGNING_SECRET,
});

export const POST = createInterviewAnswerHandler(processor, {
  onError: (error) => console.error('interview answer processing failed', error),
});
```

This exact route, mounted at `/api/interview/answer`, is what
`@interview-sdk/react`'s `<InterviewWidget mode="server">` POSTs to by
default (see that package's `ServerModeProcessor`).

`createInterviewAnswerHandler` returns a standard
`(request: Request) => Promise<Response>` (Fetch API), so it works as-is in
any router that speaks that signature — Next.js Route Handlers, Deno, Bun,
Cloudflare Workers, Hono. For Node's classic `(req, res)` style (plain
`http`, Express), adapt it with a small shim:

```ts
import { createServer } from 'node:http';

const handler = createInterviewAnswerHandler(processor);

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const request = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: Buffer.concat(chunks),
  });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}).listen(3000);
```

## Score integrity

`ServerAnswerProcessor` is constructed with your own canonical `questions`
and `rubric` — the `question`/`rubric` fields in an incoming request are
accepted (for wire compatibility with `@interview-sdk/react`) but **never
trusted for scoring**. Only `answer.questionId` is used, to look up your
configured question. A tampered client that strips a question's `concepts`
or reweights the rubric in its own favor has no effect on the resulting
score.

Pass `signingSecret` to have every returned evaluation HMAC-signed
(`evaluation.signature`). This matters because `@interview-sdk/react`
assembles the final report client-side from the per-turn evaluations it
receives — a browser is not a trusted execution environment, so a
sufficiently motivated user could edit that client-side state before it's
displayed or submitted. If you need to _prove_ a persisted/displayed report
wasn't altered after your server produced it, re-verify each stored
evaluation's signature with `verify()` before trusting it, rather than
trusting whatever aggregate the client sends back.

```ts
import { verify } from '@interview-sdk/server';

const { signature, ...evaluation } = signedEvaluation;
const isAuthentic = verify(evaluation, signature, process.env.INTERVIEW_SIGNING_SECRET!);
```

## Webhooks

```ts
import { WebhookDispatcher, verifyWebhookSignature } from '@interview-sdk/server';

const dispatcher = new WebhookDispatcher({
  url: 'https://your-app.example.com/webhooks/interview',
  secret: process.env.WEBHOOK_SECRET!,
});

await dispatcher.send('sessionEnd', { sessionId, totalScore });
```

Deliveries are HMAC-signed (`Interview-Sdk-Signature` header, Stripe/GitHub-
style: `t=<timestamp>,v1=<signature>`) and carry an
`Interview-Sdk-Idempotency-Key` header so your receiver can dedupe retried
deliveries. Verify inbound webhooks with `verifyWebhookSignature(rawBody,
header, secret)` — it also rejects payloads older than a tolerance window
(5 minutes by default) to bound replay exposure.

`WebhookDispatcher` retries with exponential backoff (default 5 attempts) but
keeps no state across process restarts — per the Zero-Infra Guarantee, this
package holds no database of its own. If delivery must survive a restart,
call `dispatcher.send()` from your own durable job queue rather than relying
on its in-memory retry loop alone.

## Testing

```bash
pnpm --filter @interview-sdk/server test
pnpm --filter @interview-sdk/server test:coverage
```

## Not yet implemented

- **No authentication or rate-limiting**: `createInterviewAnswerHandler`
  accepts and processes any request that reaches it, with no built-in caller
  identity check or request throttling. Every request results in a real,
  billed call to your AI provider — an unauthenticated, unthrottled route is
  a direct cost-based denial-of-service vector, not just a data-integrity
  concern. Put this handler behind your own auth middleware and a rate
  limiter (per-session or per-IP) before exposing it publicly; this package
  intentionally holds no auth/session store of its own (Zero-Infra
  Guarantee).
- No built-in session-hijacking prevention: the processor trusts the
  request's `previousTurns`/`currentFollowUpDepth`/`askedFollowUps` fields
  as sent. For stronger guarantees, verify these against your own persisted
  session state (e.g. a signed session token) before calling
  `processAnswer` — this package intentionally holds no session store of
  its own (Zero-Infra Guarantee).
- `WebhookDispatcher`'s retry queue is in-process only, not durable across
  restarts (documented above).
