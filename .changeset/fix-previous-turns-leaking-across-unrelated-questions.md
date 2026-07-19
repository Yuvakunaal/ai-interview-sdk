---
"@interview-sdk/react": patch
---

Fix unrelated earlier questions leaking into a later question's AI evaluation context.

Found via a real production integration: `useInterview` was passing the *entire* interview transcript so far as `previousTurns` context for every evaluation call, not just the current question's own follow-up history. In a longer interview this meant, by question 4 or 5, the AI was handed several unrelated prior answers (in one observed case, duplicate/off-topic text) in the same request — despite the evaluation prompt explicitly telling it to ignore earlier answers. That noise was enough to make a real provider misjudge a genuinely good, on-topic final answer as a non-answer.

`previousTurns` is now scoped to only the current question's own turns (i.e. its own prior follow-ups) — a brand-new top-level question correctly starts with no prior context, and a follow-up still correctly sees its own question's original answer.
