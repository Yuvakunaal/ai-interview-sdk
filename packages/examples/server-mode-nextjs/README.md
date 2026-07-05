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

This is also exactly what `npx interview-sdk init --framework nextjs`
scaffolds (see `@interview-sdk/cli`), so this example doubles as what that
command's output looks like wired up and running.
