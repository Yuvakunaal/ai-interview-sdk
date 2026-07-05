import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Rubric & evaluation cookbook' };

export default function RubricCookbook() {
  return (
    <>
      <h1>Rubric &amp; evaluation cookbook</h1>
      <p className="docs-lede">
        How scoring actually works under the hood, so you can design a rubric that behaves the way
        you expect.
      </p>

      <h2>Weights are relative, not percentages</h2>
      <p>
        <code>defineRubric()</code> normalizes whatever weights you give it — they don&apos;t need
        to sum to 100, or to anything in particular:
      </p>
      <pre>
        <code>{`defineRubric([
  { id: 'technical', label: 'Technical depth', weight: 3 },
  { id: 'communication', label: 'Communication', weight: 1 },
]);
// technical carries 75% of the total score, communication 25% — same as weight: 75/25`}</code>
      </pre>
      <p>
        It fails loud — throwing <code>RubricValidationError</code> — on an empty dimension list, a
        missing id, a duplicate id, or a non-positive weight. This runs at construction time, not
        buried inside the first evaluation call.
      </p>

      <h2>Each dimension is scored 0–100, then weighted and clamped</h2>
      <p>
        The AI provider returns a raw <code>dimensionScores</code> object; a score outside 0–100 is
        clamped rather than rejected, and the weighted total is rounded to two decimal places.
      </p>

      <h2>Concept coverage drives more than you&apos;d think</h2>
      <p>
        Declaring <code>concepts</code> on a question does three things at once: it tells the
        evaluator what to look for, it&apos;s what a hint falls back to (the concept list, not an
        AI-generated hint), and it&apos;s what the Follow-Up Engine checks before deciding whether
        to probe deeper.
      </p>
      <pre>
        <code>{`{ id: 'q1', prompt: 'Explain how hash maps handle collisions.', concepts: ['hashing', 'collisions'] }`}</code>
      </pre>

      <h2>Follow-ups are deterministic about when, not what</h2>
      <p>A follow-up is generated when all of these are true:</p>
      <ul>
        <li>
          The current follow-up depth is below <code>maxFollowUpDepth</code> (default 2).
        </li>
        <li>The answer wasn&apos;t skipped or empty.</li>
        <li>
          Either a concept was missed, <em>or</em> the total score is below 90 — a perfect,
          fully-covered answer doesn&apos;t get probed further.
        </li>
      </ul>
      <p>
        Difficulty scales with the score: below 40 asks an easier follow-up, above 75 asks a harder
        one, otherwise the same difficulty. A canned <code>branches</code> map (concept → fixed
        follow-up text) is tried before falling back to an AI-generated one — useful for a concept
        you always want probed the same way. Repeated follow-ups are rejected via text similarity,
        retried up to 3 times before giving up with a clear error rather than looping forever.
      </p>

      <h2>Hybrid AI + answer-key scoring</h2>
      <p>
        Add an <code>answerKey</code> to a question and the evaluator compares against it directly
        (via <code>matchesAnswerKey</code> in the result), on top of — not instead of — semantic
        concept matching:
      </p>
      <pre>
        <code>{`{ id: 'q1', prompt: '...', concepts: ['hashing'], answerKey: 'A reference-quality answer here.' }`}</code>
      </pre>

      <h2>Multi-turn context</h2>
      <p>
        Every evaluation call receives the full prior transcript for that session (
        <code>previousTurns</code>), so contradictions across turns and follow-up consistency are
        visible to the model — not just the current answer in isolation.
      </p>

      <h2>Verifying your rubric is actually fair</h2>
      <p>
        Don&apos;t guess. <a href="/trust-tooling">Run the Interview Simulator</a> against scripted
        candidate personas (strong, weak, off-topic, silent, adversarial) before a real candidate
        ever sees the rubric, and the <a href="/trust-tooling">Bias &amp; Consistency Harness</a>{' '}
        against labeled samples with expected score ranges to catch inconsistency across repeated
        runs.
      </p>
    </>
  );
}
