import {
  EvaluationEngine,
  FollowUpEngine,
  InterviewFlowEngine,
  defineRubric,
  type EvaluationFlag,
  type EvaluationTurn,
} from '@interview-sdk/core';
import type { InterviewCliConfig } from '../config-loader.js';
import { PERSONAS, getPersona, type Persona } from '../personas.js';

const STRONG_MIN_EXPECTED = 60;
const LOW_SCORER_MAX_EXPECTED = 40;
const ADVERSARIAL_SUSPICION_MARGIN = 5;

export interface SimulationTurn {
  questionId: string;
  isFollowUp: boolean;
  answerText: string;
  totalScore: number;
  flags: EvaluationFlag[];
  followUpGenerated?: string;
}

export interface PersonaSimulationResult {
  personaId: string;
  personaLabel: string;
  turns: SimulationTurn[];
  finalScore: number;
  warnings: string[];
  failed?: boolean;
}

export interface SimulationReport {
  personas: PersonaSimulationResult[];
  warnings: string[];
}

export interface RunSimulationOptions {
  /** Persona ids to run; defaults to all five. */
  personas?: string[];
}

async function runPersona(
  config: InterviewCliConfig,
  persona: Persona,
): Promise<PersonaSimulationResult> {
  const rubric = defineRubric(config.rubric);
  // FlowEngine and FollowUpEngine each track their own max-depth config
  // independently; without reconciling them here, config.maxFollowUpDepth
  // (which callers reasonably expect to be the single knob) would only
  // constrain the flow's bookkeeping, not the FollowUpEngine's own decision
  // to generate one — an explicit followUpConfig.maxDepth wins if set.
  const effectiveMaxDepth = config.followUpConfig?.maxDepth ?? config.maxFollowUpDepth;
  const flow = new InterviewFlowEngine({
    questions: config.questions,
    maxFollowUpDepth: effectiveMaxDepth,
  });
  const evaluationEngine = new EvaluationEngine();
  const followUpEngine = new FollowUpEngine({
    ...config.followUpConfig,
    maxDepth: effectiveMaxDepth,
  });

  flow.start();
  const turns: SimulationTurn[] = [];
  const previousTurns: EvaluationTurn[] = [];
  let finalScore = 0;

  while (!flow.isComplete()) {
    const question = flow.currentQuestion();
    if (!question) break;

    const isFollowUp = flow.getState().followUpDepthForCurrentQuestion > 0;
    const { text, isSilence } = persona.answer(question);
    const state = flow.submitAnswer({ text, isSilence });
    const answer = state.answers.at(-1)!;

    const evaluation = await evaluationEngine.evaluate({
      question,
      rubric,
      answer,
      adapter: config.adapter,
      previousTurns: [...previousTurns],
    });
    previousTurns.push({ question, answer });
    finalScore = evaluation.totalScore;

    const followUpContext = {
      question,
      answer,
      evaluation,
      currentDepth: state.followUpDepthForCurrentQuestion,
      askedFollowUps: flow.askedFollowUpsForCurrentQuestion(),
    };
    const decision = followUpEngine.decide(followUpContext);

    let followUpGenerated: string | undefined;
    if (decision.shouldGenerate) {
      const followUp = await followUpEngine.generate(followUpContext, config.adapter);
      followUpGenerated = followUp.prompt;
      flow.recordFollowUp(followUp.prompt);
    } else {
      flow.advance();
    }

    turns.push({
      questionId: question.id,
      isFollowUp,
      answerText: text,
      totalScore: evaluation.totalScore,
      flags: evaluation.flags,
      followUpGenerated,
    });
  }

  const warnings: string[] = [];
  if (persona.id === 'strong' && finalScore < STRONG_MIN_EXPECTED) {
    warnings.push(
      `"strong" scored ${finalScore} (below ${STRONG_MIN_EXPECTED}) — check whether concept ` +
        'coverage matching is too strict, or whether the rubric weighting is too harsh.',
    );
  }
  if (
    (persona.id === 'off_topic' || persona.id === 'weak') &&
    finalScore > LOW_SCORER_MAX_EXPECTED
  ) {
    warnings.push(
      `"${persona.id}" scored ${finalScore} (above ${LOW_SCORER_MAX_EXPECTED}) — check whether ` +
        'concept coverage matching is too lenient.',
    );
  }
  if (persona.id === 'silent' && finalScore > 0) {
    warnings.push(`"silent" scored ${finalScore}, expected 0 — check answer.isSilence handling.`);
  }

  return { personaId: persona.id, personaLabel: persona.label, turns, finalScore, warnings };
}

/**
 * The Interview Simulator (§11): runs scripted candidate personas through
 * the full question bank — including follow-ups — so a developer can
 * validate rubric and follow-up behavior before a real candidate ever sees
 * it. Personas are deterministic (not LLM-driven); see the CLI README for
 * that scope note.
 */
export async function runSimulation(
  config: InterviewCliConfig,
  options: RunSimulationOptions = {},
): Promise<SimulationReport> {
  const selected =
    options.personas && options.personas.length > 0
      ? options.personas.map((id) => getPersona(id))
      : PERSONAS;

  const personas: PersonaSimulationResult[] = [];
  for (const persona of selected) {
    try {
      personas.push(await runPersona(config, persona));
    } catch (error) {
      personas.push({
        personaId: persona.id,
        personaLabel: persona.label,
        turns: [],
        finalScore: 0,
        warnings: [`Simulation failed: ${error instanceof Error ? error.message : String(error)}`],
        failed: true,
      });
    }
  }

  const strongResult = personas.find((result) => result.personaId === 'strong');
  const adversarialResult = personas.find((result) => result.personaId === 'adversarial');
  if (
    strongResult &&
    adversarialResult &&
    !adversarialResult.failed &&
    adversarialResult.finalScore >= strongResult.finalScore - ADVERSARIAL_SUSPICION_MARGIN
  ) {
    adversarialResult.warnings.push(
      `"adversarial" scored ${adversarialResult.finalScore}, close to or above "strong" ` +
        `(${strongResult.finalScore}) — the AI provider may be following instructions embedded ` +
        "in the candidate's answer instead of grading it. Verify your adapter isolates candidate text.",
    );
  }

  return { personas, warnings: personas.flatMap((result) => result.warnings) };
}
