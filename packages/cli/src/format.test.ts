import { describe, expect, it } from 'vitest';
import type { BiasHarnessReport } from './commands/bias-harness.js';
import type { SimulationReport } from './commands/simulate.js';
import { formatBiasHarnessReport, formatPackValidation, formatSimulationReport } from './format.js';
import type { QuestionPackValidationResult } from './question-pack.js';

describe('formatSimulationReport', () => {
  const report: SimulationReport = {
    personas: [
      {
        personaId: 'strong',
        personaLabel: 'Strong answer',
        finalScore: 92,
        warnings: [],
        turns: [
          { questionId: 'q1', isFollowUp: false, answerText: 'x', totalScore: 92, flags: [] },
        ],
      },
    ],
    warnings: [],
  };

  it('renders JSON when requested', () => {
    const output = formatSimulationReport(report, true);
    expect(JSON.parse(output)).toEqual(report);
  });

  it('renders a readable summary with the final score', () => {
    const output = formatSimulationReport(report);
    expect(output).toContain('Strong answer (strong)');
    expect(output).toContain('final score: 92');
    expect(output).toContain('All personas behaved as expected.');
  });

  it('renders a follow-up-asked line and a persona-level warning line', () => {
    const reportWithFollowUp: SimulationReport = {
      personas: [
        {
          personaId: 'weak',
          personaLabel: 'Weak answer',
          finalScore: 75,
          warnings: [
            '"weak" scored 75 (above 40) — check whether concept coverage matching is too lenient.',
          ],
          turns: [
            {
              questionId: 'q1',
              isFollowUp: false,
              answerText: 'x',
              totalScore: 75,
              flags: [],
              followUpGenerated: 'Can you say more?',
            },
          ],
        },
      ],
      warnings: [
        '"weak" scored 75 (above 40) — check whether concept coverage matching is too lenient.',
      ],
    };
    const output = formatSimulationReport(reportWithFollowUp);
    expect(output).toContain('-> follow-up asked: "Can you say more?"');
    expect(output).toContain('WARNING: "weak" scored 75');
  });

  it('surfaces a failed persona distinctly from a scored one', () => {
    const failedReport: SimulationReport = {
      personas: [
        {
          personaId: 'weak',
          personaLabel: 'Weak answer',
          finalScore: 0,
          turns: [],
          warnings: ['Simulation failed: boom'],
          failed: true,
        },
      ],
      warnings: ['Simulation failed: boom'],
    };
    const output = formatSimulationReport(failedReport);
    expect(output).toContain('FAILED');
    expect(output).toContain('1 warning(s)');
  });
});

describe('formatBiasHarnessReport', () => {
  const report: BiasHarnessReport = {
    samples: [
      {
        questionId: 'q1',
        label: 'strong-sample',
        expectedScoreRange: [80, 100],
        scores: [90, 92, 91],
        mean: 91,
        stddev: 0.8,
        withinRange: true,
        consistent: true,
      },
    ],
    passRate: 1,
    warnings: [],
  };

  it('renders JSON when requested', () => {
    expect(JSON.parse(formatBiasHarnessReport(report, true))).toEqual(report);
  });

  it('renders a PASS line with scores and pass rate', () => {
    const output = formatBiasHarnessReport(report);
    expect(output).toContain('[PASS] strong-sample');
    expect(output).toContain('Pass rate: 100%');
  });

  it('renders a WARNING line for each reported warning', () => {
    const failingReport: BiasHarnessReport = {
      ...report,
      passRate: 0,
      warnings: ['"strong-sample" scored outside [80, 100]: got 40, 42, 41.'],
    };
    const output = formatBiasHarnessReport(failingReport);
    expect(output).toContain('WARNING: "strong-sample" scored outside');
  });
});

describe('formatPackValidation', () => {
  it('renders a one-line summary for a valid pack', () => {
    const result: QuestionPackValidationResult = {
      valid: true,
      issues: [],
      pack: {
        name: 'dsa',
        questions: [{ id: 'q1', prompt: 'x' }],
        rubric: [{ id: 'technical', label: 'Technical', weight: 1 }],
      },
    };
    expect(formatPackValidation(result, 'pack.json')).toBe(
      'pack.json: valid (1 questions, 1 rubric dimensions)',
    );
  });

  it('renders each issue on its own line for an invalid pack', () => {
    const result: QuestionPackValidationResult = {
      valid: false,
      issues: ['bad thing', 'other thing'],
    };
    const output = formatPackValidation(result, 'pack.json');
    expect(output).toContain('pack.json: invalid');
    expect(output).toContain('- bad thing');
    expect(output).toContain('- other thing');
  });
});
