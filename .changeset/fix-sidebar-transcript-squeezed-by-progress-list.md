---
"@interview-sdk/react": patch
---

Fix the transcript/feedback panel getting squeezed to a sliver in interviews with more questions.

Found via real usage: the "Interview progress" checklist in `InterviewWidget`'s sidebar had no height cap, so its natural height grew with every question in the interview. Past roughly 4-5 questions it ate enough of the sidebar's fixed height budget that the transcript below it — where the candidate's answers and the AI's feedback actually show up — got squeezed down to a barely-visible sliver instead of scrolling properly within its own space.

The progress checklist (and the rubric "Live signals" list below the transcript, which had the same unbounded-growth pattern) now caps its own height and scrolls internally, so neither one can crowd out the transcript regardless of how many questions or rubric dimensions are configured. The transcript reliably gets a real, generous amount of space now.
