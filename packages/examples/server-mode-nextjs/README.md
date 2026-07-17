# @interview-sdk/example-server-mode-nextjs

A runnable Next.js example of **Server Mode**: `<InterviewWidget mode="server" />`
talking to an API route built with `@interview-sdk/server`.

Unlike a Client Mode demo, this is the shape you'd actually ship — the AI
provider adapter and key live only in `app/api/interview/answer/route.ts`,
on the server. The browser never has write access to the score.

## Run it

```bash
pnpm install
pnpm --filter @interview-sdk/example-server-mode-nextjs dev
```

Then open http://localhost:3000. It runs with **zero setup** — the API
route defaults to a mock adapter (`lib/mock-adapter.ts`) that fakes
plausible scores without any API key or network call, purely so the widget
has something real to render.

## Making it real

Swap the mock adapter for an actual provider in
`app/api/interview/answer/route.ts`:

```ts
import { OpenAIAdapter } from '@interview-sdk/adapter-openai';

const processor = new ServerAnswerProcessor({
  questions,
  rubric,
  adapter: new OpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
  signingSecret: process.env.INTERVIEW_SIGNING_SECRET,
});
```

That's the only change — `<InterviewWidget mode="server" />` on the client
side doesn't need to know anything changed.

`npx interview-sdk init --framework nextjs` (see `@interview-sdk/cli`)
scaffolds the same shape of route, wired the same way — but with a
fail-loud placeholder adapter instead of this example's mock one, since a
freshly-scaffolded production project should refuse to run silently on fake
data until you configure a real provider. Use this example to see the
whole thing running end to end; use `init` to start a real project.

Voice input/output works the same way: `app/api/voice/synthesize/route.ts`
and `app/api/voice/transcribe/route.ts` use `lib/mock-voice.ts` by default
(a beep and a placeholder transcript, no key), proxied through this app's
own server so a real provider key — once you swap one in, per the TODO in
each route — never reaches the browser either.

## Verifying the final report

Set `INTERVIEW_SIGNING_SECRET` and every evaluation `/api/interview/answer`
returns is HMAC-signed. `app/page.tsx`'s `onSessionEnd` POSTs the finished
report to `app/api/interview/complete/route.ts`, which re-verifies each
per-turn signature with `verify()` from `@interview-sdk/server` before
treating the report as trustworthy — the whole point being that the report
`onSessionEnd` receives was assembled in the browser, which isn't a trusted
execution environment. Try it: set the env var, open devtools, edit a
score in the React state before the interview ends, and watch
`/api/interview/complete` reject it.
