import type { AIProviderAdapter, CompletionRequest, CompletionResponse } from '@interview-sdk/core';

/**
 * A fake AIProviderAdapter for this local dashboard preview — no API key,
 * no network call. It parses the structured prompt @interview-sdk/core
 * sends (see packages/core/src/evaluation/prompt.ts and
 * follow-up/prompt.ts) well enough to return plausible scores and a
 * follow-up question, purely so the widget has something to render.
 * Never use this in a real app — plug in one of the
 * @interview-sdk/adapter-* packages instead.
 */
export function createMockAdapter(): AIProviderAdapter {
  return {
    id: 'mock-dashboard',
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
      const system = request.messages.find((m) => m.role === 'system')?.content ?? '';
      const answer = request.messages.at(-1)?.content ?? '';

      const text = system.includes('crafting exactly ONE dynamic follow-up question')
        ? buildFollowUpResponse(system)
        : buildEvaluationResponse(system, answer);

      return { text };
    },
  };
}

function part(system: string, prefix: string): string | undefined {
  return system
    .split('\n\n')
    .find((p) => p.startsWith(prefix))
    ?.slice(prefix.length);
}

function buildEvaluationResponse(system: string, answer: string): string {
  const dimensions: Array<{ id: string }> = JSON.parse(part(system, 'Rubric dimensions: ') ?? '[]');
  const concepts: string[] = JSON.parse(part(system, 'Expected concepts: ') ?? '[]');
  const answerLower = answer.toLowerCase();

  const conceptCoverage = concepts.map((concept) => ({
    concept,
    covered: answerLower.includes(concept.toLowerCase()),
  }));
  const coveredFraction =
    concepts.length > 0
      ? conceptCoverage.filter((c) => c.covered).length / concepts.length
      : Math.min(answer.trim().length / 200, 1);

  const conceptScore = Math.round(30 + coveredFraction * 70);
  const generalScore = Math.round(Math.min(40 + answer.trim().length / 8, 92));

  const dimensionScores = Object.fromEntries(
    dimensions.map((d, i) => [d.id, i === 0 ? conceptScore : generalScore]),
  );

  return JSON.stringify({
    dimensionScores,
    conceptCoverage,
    contradictions: [],
    flags: concepts.length > 0 && coveredFraction < 1 ? ['partial_concept_coverage'] : [],
    rationale: buildRationale(conceptCoverage, coveredFraction),
  });
}

/**
 * A plausible one-line rationale, standing in for what a real evaluation
 * engine call would return in EvaluationResult.rationale (see
 * packages/core/src/evaluation/evaluation-engine.ts) — real adapters
 * generate this from the model itself; the mock just needs something to
 * exercise FeedbackNote/TranscriptChat with.
 */
function buildRationale(
  conceptCoverage: Array<{ concept: string; covered: boolean }>,
  coveredFraction: number,
): string {
  if (conceptCoverage.length === 0) {
    return coveredFraction >= 0.6
      ? 'Clear, well-structured answer — nice work.'
      : 'A bit thin on detail — worth expanding next time.';
  }

  const missed = conceptCoverage.filter((c) => !c.covered).map((c) => c.concept);
  const covered = conceptCoverage.filter((c) => c.covered).map((c) => c.concept);

  if (missed.length === 0) {
    return `Strong answer — covers ${covered.join(' and ')} clearly. Ready for the next question.`;
  }
  if (covered.length > 0) {
    return `Good start, but light on ${missed.join(', ')}. A follow-up should help fill that in.`;
  }
  return `Didn't touch on ${missed.join(', ')} — let's probe that with a follow-up.`;
}

function buildFollowUpResponse(system: string): string {
  const missedMatch = system.match(/missed or only partially covered: (\[.*?\])\./);
  const missed: string[] = missedMatch ? JSON.parse(missedMatch[1] ?? '[]') : [];
  const difficultyMatch = system.match(/Make the follow-up (\w+) relative/);
  const difficulty = (difficultyMatch?.[1] ?? 'same') as 'easier' | 'same' | 'harder';

  const prompt =
    missed.length > 0
      ? `Can you go deeper on ${missed[0]} and how it applies here?`
      : `Nice — can you walk through a trade-off or edge case for that approach?`;

  return JSON.stringify({ prompt, difficulty, targetsMissedConcepts: missed.slice(0, 1) });
}
