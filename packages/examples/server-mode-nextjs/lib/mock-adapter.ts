import type { AIProviderAdapter, CompletionRequest, CompletionResponse } from '@interview-sdk/core';

/**
 * A fake AIProviderAdapter so this example runs with zero setup — no API
 * key, no network call. It parses the structured prompt @interview-sdk/core
 * sends (see packages/core/src/evaluation/prompt.ts and
 * follow-up/prompt.ts) well enough to return plausible scores and a
 * follow-up. Swap this for a real @interview-sdk/adapter-* in production —
 * see app/api/interview/answer/route.ts.
 *
 * Note this lives under lib/, imported only by the API route: in Server
 * Mode the adapter (and any real API key) never reaches the browser.
 */
export function createMockAdapter(): AIProviderAdapter {
  return {
    id: 'mock-demo',
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
      const system = request.messages.find((message) => message.role === 'system')?.content ?? '';
      const answer = request.messages.at(-1)?.content ?? '';

      const text = system.includes('crafting exactly ONE dynamic follow-up question')
        ? buildFollowUpResponse(system)
        : buildEvaluationResponse(system, answer);

      return { text };
    },
  };
}

function section(system: string, prefix: string): string | undefined {
  return system
    .split('\n\n')
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

function buildEvaluationResponse(system: string, answer: string): string {
  const dimensions: Array<{ id: string }> = JSON.parse(
    section(system, 'Rubric dimensions: ') ?? '[]',
  );
  const concepts: string[] = JSON.parse(section(system, 'Expected concepts: ') ?? '[]');
  const answerLower = answer.toLowerCase();

  const conceptCoverage = concepts.map((concept) => ({
    concept,
    covered: answerLower.includes(concept.toLowerCase()),
  }));
  const coveredFraction =
    concepts.length > 0
      ? conceptCoverage.filter((entry) => entry.covered).length / concepts.length
      : Math.min(answer.trim().length / 200, 1);

  const conceptScore = Math.round(30 + coveredFraction * 70);
  const generalScore = Math.round(Math.min(40 + answer.trim().length / 8, 92));
  const dimensionScores = Object.fromEntries(
    dimensions.map((dimension, index) => [dimension.id, index === 0 ? conceptScore : generalScore]),
  );

  return JSON.stringify({
    dimensionScores,
    conceptCoverage,
    contradictions: [],
    flags: concepts.length > 0 && coveredFraction < 1 ? ['partial_concept_coverage'] : [],
  });
}

function buildFollowUpResponse(system: string): string {
  const missedMatch = /missed or only partially covered: (\[.*?\])\./.exec(system);
  const missed: string[] = missedMatch?.[1] ? JSON.parse(missedMatch[1]) : [];
  const difficultyMatch = /Make the follow-up (\w+) relative/.exec(system);
  const difficulty = (difficultyMatch?.[1] ?? 'same') as 'easier' | 'same' | 'harder';

  const prompt =
    missed.length > 0
      ? `Can you go deeper on ${missed[0]} and how it applies here?`
      : 'Nice — can you walk through a trade-off or edge case for that approach?';

  return JSON.stringify({ prompt, difficulty, targetsMissedConcepts: missed.slice(0, 1) });
}
