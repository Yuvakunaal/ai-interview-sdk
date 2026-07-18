---
"@interview-sdk/react": patch
---

Fix two real voice-mode UX gaps found in live usage: `QuestionCard` let a candidate submit a blank answer, and the AI interviewer's tile was an unlabeled circle.

- **"Submit answer" is now disabled for a blank/whitespace-only answer, and while recording is in progress.** A voice transcript only lands in the answer box once recording stops, so the box reads empty the whole time recording is active — previously "Submit answer" stayed clickable through that window and would silently submit a blank answer if clicked mid-recording (or any time nothing had been typed, in every mode). It now re-enables automatically once real text is present.
- **The AI interviewer's tile now shows an "AI" identity label**, matching how the candidate's tile already shows an initial (e.g. "Y") — previously it was a bare circle with no identity mark at all until the AI actually started speaking. The label is replaced by the live speaking-amplitude meter the instant playback starts.
