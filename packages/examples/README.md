# examples

Two runnable example apps:

- **[`server-mode-nextjs`](./server-mode-nextjs)** — the production path:
  `<InterviewWidget mode="server" />` talking to a real `@interview-sdk/server`
  route (mock adapter by default, swap in a real one for a live key). Runs
  with zero setup.
- **[`basic-demo`](./basic-demo)** — the prototyping path: Client Mode in the
  browser, also zero setup, no API key required.

Together they cover the 5-step Success Criteria from the product spec:
install → API key → questions + rubric → `<InterviewWidget />` → run.
