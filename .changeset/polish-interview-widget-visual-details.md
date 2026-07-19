---
"@interview-sdk/react": patch
---

Polish the interview UI's visual details — no structural or behavioral changes, pure CSS.

- **The "Interview progress" checklist is now an actual timeline**, not just a flat list: a connecting rail threads through it, dashed and muted for ground not yet covered, solid pass-green for a question actually answered — the line style itself carries meaning, not just its color.
- **The live AI/candidate tiles get a soft ambient glow** while actually speaking/recording, instead of just a border-color swap — more depth and presence for whichever side currently has the floor.
- **The plain (non-composer) answer textarea's focus state** now matches the nicer glow ring the composer variant already used, instead of a flat 2px outline — one consistent "focused input" treatment everywhere.
- **The report's "Complete" stamp draws its checkmark in** the moment the report actually arrives, instead of appearing fully-formed and static — a small, real completion moment. Respects `prefers-reduced-motion`.
