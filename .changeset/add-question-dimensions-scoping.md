---
"@interview-sdk/core": minor
"@interview-sdk/react": patch
---

Add `Question.dimensions` so a question can declare which rubric dimensions it actually assesses — fixing reports that scored a real, unrelated rubric dimension at a false 0.

Found from a real report: a 3-dimension rubric (Technical accuracy, Communication clarity, Systems thinking) used against plain SQL syntax-recall questions ("What is a SELECT statement?"). "Systems thinking" has nothing to grade on a question like that, but it scored 0 every time anyway — dragging a candidate's weighted total from what should have been a fair score down to 6.67/100, and showing "Systems thinking: 0/100" in the report as if the candidate had failed something they were never asked about.

- **`Question.dimensions?: string[]`** (`@interview-sdk/core`) — the subset of rubric dimension ids this question assesses. Omit for the previous, still fully-supported default (every question assesses every dimension). When set, the AI is only asked to score the listed dimensions, `totalScore` is computed from only those (re-normalized so the question can still reach 100%), and dimensions outside that set never appear in `dimensionScores` at all — not present at 0. New `scopeRubricToQuestion(rubric, question.dimensions)` export does this scoping directly if you need it.
- **`InterviewReport.dimensionAverages`** (`@interview-sdk/react`) now only has a key for a dimension at least one question actually assessed across the whole interview — a dimension no question ever addressed is simply absent, not averaged in at a misleading 0.
- **`ScoreSummary`** now omits the row for a dimension with no data at all, instead of rendering a demoralizing "0/100" for something the candidate was never assessed on.

Verified end-to-end against real Groq responses reproducing the exact reported scenario: the same rubric and questions, scoped to `dimensions: ['technical', 'communication']`, now correctly omit "Systems thinking" from every score and the final report.
