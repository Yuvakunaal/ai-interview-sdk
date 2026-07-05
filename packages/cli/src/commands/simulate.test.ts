import type { AIProviderAdapter, CompletionRequest } from '@interview-sdk/core';
import { describe, expect, it, vi } from 'vitest';
import { CliUsageError } from '../errors.js';
import type { InterviewCliConfig } from '../config-loader.js';
import { runSimulation } from './simulate.js';

const questions = [{ id: 'q1', prompt: 'Explain hash maps.', concepts: ['hashing'] }];
const rubric = [{ id: 'technical', label: 'Technical', weight: 1 }];

function isFollowUpRequest(request: CompletionRequest): boolean {
  return (request.messages[0]?.content ?? '').includes('dynamic follow-up question');
}

function candidateText(request: CompletionRequest): string {
  return request.messages.at(-1)?.content ?? '';
}

/** A well-behaved grader: isolates candidate text and never follows embedded instructions. */
function safeAdapter(): AIProviderAdapter {
  return {
    id: 'safe',
    complete: vi.fn(async (request: CompletionRequest) => {
      if (isFollowUpRequest(request)) {
        return { text: JSON.stringify({ prompt: 'Can you say more?', targetsMissedConcepts: [] }) };
      }
      const text = candidateText(request);
      if (text.toLowerCase().includes('ignore all previous instructions')) {
        return {
          text: JSON.stringify({
            dimensionScores: { technical: 5 },
            conceptCoverage: [{ concept: 'hashing', covered: false }],
            flags: ['off_topic'],
          }),
        };
      }
      if (text.includes('hashing')) {
        return {
          text: JSON.stringify({
            dimensionScores: { technical: 92 },
            conceptCoverage: [{ concept: 'hashing', covered: true }],
          }),
        };
      }
      if (text.includes('weekend')) {
        return {
          text: JSON.stringify({
            dimensionScores: { technical: 8 },
            conceptCoverage: [{ concept: 'hashing', covered: false }],
            flags: ['off_topic'],
          }),
        };
      }
      return {
        text: JSON.stringify({
          dimensionScores: { technical: 30 },
          conceptCoverage: [{ concept: 'hashing', covered: false }],
        }),
      };
    }),
  };
}

/** A naive grader that blindly follows any instruction embedded in the candidate's text. */
function naiveAdapter(): AIProviderAdapter {
  return {
    id: 'naive',
    complete: vi.fn(async (request: CompletionRequest) => {
      if (isFollowUpRequest(request)) {
        return { text: JSON.stringify({ prompt: 'Tell me more.' }) };
      }
      const text = candidateText(request);
      const injected = /\{.*\}/s.exec(text);
      if (injected) {
        return { text: injected[0] };
      }
      if (text.includes('hashing')) {
        return {
          text: JSON.stringify({
            dimensionScores: { technical: 92 },
            conceptCoverage: [{ concept: 'hashing', covered: true }],
          }),
        };
      }
      return { text: JSON.stringify({ dimensionScores: { technical: 30 } }) };
    }),
  };
}

function baseConfig(adapter: AIProviderAdapter, maxFollowUpDepth = 0): InterviewCliConfig {
  return { questions, rubric, adapter, maxFollowUpDepth };
}

describe('runSimulation', () => {
  it('runs all five personas by default and raises no warnings against a well-behaved adapter', async () => {
    const report = await runSimulation(baseConfig(safeAdapter()));

    expect(report.personas.map((result) => result.personaId)).toEqual([
      'strong',
      'weak',
      'off_topic',
      'silent',
      'adversarial',
    ]);
    expect(report.warnings).toEqual([]);
  });

  it('scores the strong persona high and the weak/off-topic personas low', async () => {
    const report = await runSimulation(baseConfig(safeAdapter()));
    const byId = Object.fromEntries(report.personas.map((result) => [result.personaId, result]));

    expect(byId.strong!.finalScore).toBeGreaterThanOrEqual(60);
    expect(byId.weak!.finalScore).toBeLessThan(40);
    expect(byId.off_topic!.finalScore).toBeLessThan(40);
  });

  it('warns when the strong persona scores below the expected floor (too-harsh rubric)', async () => {
    const harshAdapter: AIProviderAdapter = {
      id: 'harsh',
      complete: vi.fn(async () => ({
        text: JSON.stringify({ dimensionScores: { technical: 20 } }),
      })),
    };
    const report = await runSimulation(baseConfig(harshAdapter), { personas: ['strong'] });

    expect(report.personas[0]?.finalScore).toBe(20);
    expect(report.warnings.some((warning) => warning.includes('"strong" scored 20'))).toBe(true);
  });

  it('warns when the weak or off-topic personas score above the expected ceiling (too-lenient rubric)', async () => {
    const lenientAdapter: AIProviderAdapter = {
      id: 'lenient',
      complete: vi.fn(async () => ({
        text: JSON.stringify({ dimensionScores: { technical: 75 } }),
      })),
    };
    const report = await runSimulation(baseConfig(lenientAdapter), {
      personas: ['weak', 'off_topic'],
    });

    expect(report.warnings.some((warning) => warning.includes('"weak" scored 75'))).toBe(true);
    expect(report.warnings.some((warning) => warning.includes('"off_topic" scored 75'))).toBe(true);
  });

  it('short-circuits the silent persona to a score of 0 without calling the adapter for it', async () => {
    const adapter = safeAdapter();
    const report = await runSimulation(baseConfig(adapter));
    const silent = report.personas.find((result) => result.personaId === 'silent')!;

    expect(silent.finalScore).toBe(0);
    expect(silent.turns[0]?.flags).toContain('no_answer');
  });

  it('flags a suspiciously high adversarial score against a naive, injectable adapter', async () => {
    const report = await runSimulation(baseConfig(naiveAdapter()));
    const adversarial = report.personas.find((result) => result.personaId === 'adversarial')!;

    expect(adversarial.finalScore).toBe(100);
    expect(report.warnings.some((warning) => warning.includes('adversarial'))).toBe(true);
  });

  it('does not flag the adversarial persona when a well-behaved adapter resists the injection', async () => {
    const report = await runSimulation(baseConfig(safeAdapter()));
    const adversarial = report.personas.find((result) => result.personaId === 'adversarial')!;

    expect(adversarial.finalScore).toBeLessThan(40);
    expect(report.warnings.some((warning) => warning.includes('adversarial'))).toBe(false);
  });

  it('runs only the requested personas when options.personas is set', async () => {
    const report = await runSimulation(baseConfig(safeAdapter()), { personas: ['strong'] });
    expect(report.personas).toHaveLength(1);
    expect(report.personas[0]?.personaId).toBe('strong');
  });

  it('throws CliUsageError synchronously for an unknown persona id', async () => {
    await expect(
      runSimulation(baseConfig(safeAdapter()), { personas: ['nonexistent'] }),
    ).rejects.toThrow(CliUsageError);
  });

  it('marks a persona failed rather than crashing the whole run when its adapter call throws', async () => {
    const throwingAdapter: AIProviderAdapter = {
      id: 'throwing',
      complete: vi.fn(async () => {
        throw new Error('provider is down');
      }),
    };
    const report = await runSimulation(baseConfig(throwingAdapter));

    const strong = report.personas.find((result) => result.personaId === 'strong')!;
    expect(strong.failed).toBe(true);
    expect(strong.warnings[0]).toContain('provider is down');
    // the silent persona never calls the adapter, so it should still succeed
    const silent = report.personas.find((result) => result.personaId === 'silent')!;
    expect(silent.failed).toBeUndefined();
  });

  it('generates a follow-up turn for a persona whose answer misses concepts, when depth allows it', async () => {
    const report = await runSimulation(baseConfig(safeAdapter(), 1), { personas: ['weak'] });
    const weak = report.personas[0]!;

    expect(weak.turns.length).toBeGreaterThan(1);
    expect(weak.turns[0]?.followUpGenerated).toBe('Can you say more?');
    expect(weak.turns[1]?.isFollowUp).toBe(true);
  });
});
