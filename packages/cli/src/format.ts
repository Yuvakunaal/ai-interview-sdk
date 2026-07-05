import type { BiasHarnessReport } from './commands/bias-harness.js';
import type { SimulationReport } from './commands/simulate.js';
import type { QuestionPackValidationResult } from './question-pack.js';

export function formatSimulationReport(report: SimulationReport, json = false): string {
  if (json) return JSON.stringify(report, null, 2);

  const lines: string[] = [];
  for (const persona of report.personas) {
    lines.push(`${persona.personaLabel} (${persona.personaId})`);
    if (persona.failed) {
      lines.push(`  FAILED — ${persona.warnings[0] ?? 'unknown error'}`);
      lines.push('');
      continue;
    }

    lines.push(`  final score: ${persona.finalScore}`);
    for (const turn of persona.turns) {
      const marker = turn.isFollowUp ? '  follow-up' : '  question ';
      const flagSuffix = turn.flags.length > 0 ? ` [${turn.flags.join(', ')}]` : '';
      lines.push(`${marker} ${turn.questionId}: score ${turn.totalScore}${flagSuffix}`);
      if (turn.followUpGenerated) {
        lines.push(`    -> follow-up asked: "${turn.followUpGenerated}"`);
      }
    }
    for (const warning of persona.warnings) {
      lines.push(`  WARNING: ${warning}`);
    }
    lines.push('');
  }

  lines.push(
    report.warnings.length === 0
      ? 'All personas behaved as expected.'
      : `${report.warnings.length} warning(s) — review before a real candidate sees this rubric.`,
  );
  return lines.join('\n');
}

export function formatBiasHarnessReport(report: BiasHarnessReport, json = false): string {
  if (json) return JSON.stringify(report, null, 2);

  const lines: string[] = [];
  for (const sample of report.samples) {
    const status = sample.withinRange && sample.consistent ? 'PASS' : 'FAIL';
    lines.push(
      `[${status}] ${sample.label ?? sample.questionId}: scores=[${sample.scores.join(', ')}] ` +
        `mean=${sample.mean.toFixed(1)} stddev=${sample.stddev.toFixed(1)} ` +
        `expected=[${sample.expectedScoreRange.join(', ')}]`,
    );
  }
  lines.push('');
  lines.push(`Pass rate: ${(report.passRate * 100).toFixed(0)}%`);
  if (report.warnings.length > 0) {
    lines.push('');
    for (const warning of report.warnings) lines.push(`WARNING: ${warning}`);
  }
  return lines.join('\n');
}

export function formatPackValidation(
  result: QuestionPackValidationResult,
  filePath: string,
  json = false,
): string {
  if (json) return JSON.stringify(result, null, 2);
  if (result.valid) {
    return (
      `${filePath}: valid (${result.pack?.questions.length ?? 0} questions, ` +
      `${result.pack?.rubric.length ?? 0} rubric dimensions)`
    );
  }
  return [`${filePath}: invalid`, ...result.issues.map((issue) => `  - ${issue}`)].join('\n');
}
