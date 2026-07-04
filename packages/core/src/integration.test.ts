import { describe, expect, it } from 'vitest';
import {
  AdapterRegistry,
  EvaluationEngine,
  FollowUpEngine,
  InterviewFlowEngine,
  defineRubric,
  validateInterviewConfig,
  type AIProviderAdapter,
  type CompletionRequest,
  type InterviewConfig,
} from './index.js';

function scriptedAdapter(id: string, responses: string[]): AIProviderAdapter {
  let call = 0;
  return {
    id,
    async complete(_request: CompletionRequest) {
      const text = responses[Math.min(call, responses.length - 1)] ?? '{}';
      call += 1;
      return { text };
    },
  };
}

describe('core public API integration', () => {
  it('runs a full question -> evaluate -> follow-up -> advance -> completion cycle through the barrel export', async () => {
    const config: InterviewConfig = {
      questions: [
        {
          id: 'q1',
          prompt: 'Explain how a hash map works.',
          concepts: ['hashing', 'collision resolution'],
        },
      ],
      rubric: [
        { id: 'technical', label: 'Technical', weight: 3 },
        { id: 'communication', label: 'Communication', weight: 1 },
      ],
      maxFollowUpDepth: 1,
    };
    validateInterviewConfig(config);

    const rubric = defineRubric(config.rubric);
    const registry = new AdapterRegistry();
    registry.registerAIProvider(
      scriptedAdapter('fake', [
        JSON.stringify({
          dimensionScores: { technical: 55, communication: 60 },
          conceptCoverage: [
            { concept: 'hashing', covered: true },
            { concept: 'collision resolution', covered: false },
          ],
          flags: ['partial_concept_coverage'],
        }),
        JSON.stringify({
          prompt: 'What happens when two keys hash to the same bucket?',
          targetsMissedConcepts: ['collision resolution'],
        }),
      ]),
    );
    const adapter = registry.getAIProvider('fake');

    const flow = new InterviewFlowEngine({
      questions: config.questions,
      maxFollowUpDepth: config.maxFollowUpDepth,
    });
    const evaluationEngine = new EvaluationEngine();
    const followUpEngine = new FollowUpEngine();

    flow.start();
    flow.submitAnswer({ text: 'A hash map hashes keys into buckets using a hash function.' });

    const question = flow.currentQuestion();
    expect(question).toBeDefined();
    const answer = flow.getState().answers.at(-1);
    expect(answer).toBeDefined();

    const evaluation = await evaluationEngine.evaluate({
      question: question!,
      rubric,
      answer: answer!,
      adapter,
    });
    expect(evaluation.totalScore).toBeCloseTo(55 * 0.75 + 60 * 0.25);

    const decision = followUpEngine.decide({
      question: question!,
      answer: answer!,
      evaluation,
      currentDepth: flow.getState().followUpDepthForCurrentQuestion,
      askedFollowUps: flow.askedFollowUpsForCurrentQuestion(),
    });
    expect(decision.shouldGenerate).toBe(true);

    const followUp = await followUpEngine.generate(
      {
        question: question!,
        answer: answer!,
        evaluation,
        currentDepth: flow.getState().followUpDepthForCurrentQuestion,
        askedFollowUps: flow.askedFollowUpsForCurrentQuestion(),
      },
      adapter,
    );
    expect(followUp.targetsMissedConcepts).toContain('collision resolution');

    flow.recordFollowUp(followUp.prompt);
    flow.submitAnswer({
      text: 'The second key gets probed to the next open bucket (open addressing).',
    });

    const finalState = flow.advance();
    expect(finalState.status).toBe('completed');
    expect(finalState.answers).toHaveLength(2);
  });
});
