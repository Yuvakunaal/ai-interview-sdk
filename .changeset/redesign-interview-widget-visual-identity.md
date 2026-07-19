---
"@interview-sdk/react": minor
---

Major visual redesign of the interview UI — a genuine design pass, not incremental polish. No public prop APIs changed; every existing integration keeps working exactly as before.

- **The AI/candidate "video call" tiles are gone**, replaced by a slim horizontal channel strip — this SDK isn't simulating a video call, it's running a recorded, scored exchange, so the chrome recedes and the actual question gets the space and visual weight instead.
- **The session timer is now a real timecode chip** instead of a bare number with a progress sliver underneath.
- **Each question gets a real plate-style index mark** ("01", "02"...) alongside a noticeably bigger, more confident prompt — the question is the point of the page, not a caption.
- **Live Signals is now a cluster of vertical instrument meters** (think a mixing console's level meters) instead of the horizontal "skill bar" almost every scoring UI defaults to — each meter carries a real tick at the same score threshold (`STRENGTH_THRESHOLD`, now exported from `build-report.ts`) the final report uses to call a dimension a strength, so "does this clear the bar" reads at a glance.
- **The sidebar reads as one continuous record** — progress, transcript, and live signals now share a consistent "TRANSCRIPT"/"LIVE SIGNALS" heading treatment instead of feeling like three separate stacked widgets. The transcript's empty state also got a more useful message ("Nothing recorded yet — this fills in as you answer." instead of "No messages yet.").
- **The lobby screen's title got real typographic weight**, matching the new confident scale used elsewhere.
- **The final report's overall score is now a genuine hero number** — large, bold, and labeled, instead of a small inline chip buried in a sentence.

Verified extensively: full interview flow driven end-to-end through the real widget in both light and dark mode and at mobile width, screenshotting every state (lobby, question, hint, follow-up, report) — plus confirmed zero console/page errors throughout. All 247 existing tests pass (two were intentionally updated for the changed empty-state copy and restructured score markup, not loosened). Lint, typecheck, and the full monorepo build are all clean.
