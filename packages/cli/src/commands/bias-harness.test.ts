import type { AIProviderAdapter } from '@interview-sdk/core';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CliConfigError } from '../errors.js';
import { loadBiasHarnessSamples, runBiasHarness, type BiasSample } from './bias-harness.js';

const questions = [{ id: 'q1', prompt: 'Explain hash maps.', concepts: ['hashing'] }];
const rubric = [{ id: 'technical', label: 'Technical', weight: 1 }];

function scoreQueueAdapter(scores: number[]): AIProviderAdapter {
  let call = 0;
  return {
    id: 'fake',
    complete: vi.fn(async () => {
      const score = scores[Math.min(call, scores.length - 1)]!;
      call += 1;
      return { text: JSON.stringify({ dimensionScores: { technical: score } }) };
    }),
  };
}

describe('runBiasHarness', () => {
  const samples: BiasSample[] = [
    {
      questionId: 'q1',
      answerText: 'It uses buckets.',
      expectedScoreRange: [80, 100],
      label: 'strong-sample',
    },
  ];

  it('reports a passing, consistent sample when scores are stable and in range', async () => {
    const adapter = scoreQueueAdapter([90, 90, 90]);
    const report = await runBiasHarness({ questions, rubric, adapter }, samples, { runs: 3 });

    expect(report.samples[0]?.withinRange).toBe(true);
    expect(report.samples[0]?.consistent).toBe(true);
    expect(report.samples[0]?.stddev).toBe(0);
    expect(report.passRate).toBe(1);
    expect(report.warnings).toEqual([]);
  });

  it('flags a sample whose score falls outside the expected range', async () => {
    const adapter = scoreQueueAdapter([40, 40, 40]);
    const report = await runBiasHarness({ questions, rubric, adapter }, samples, { runs: 3 });

    expect(report.samples[0]?.withinRange).toBe(false);
    expect(report.warnings.some((w) => w.includes('strong-sample') && w.includes('outside'))).toBe(
      true,
    );
    expect(report.passRate).toBe(0);
  });

  it('flags a sample with high run-to-run variance even if the mean is within range', async () => {
    const adapter = scoreQueueAdapter([80, 100, 82]);
    const report = await runBiasHarness({ questions, rubric, adapter }, samples, {
      runs: 3,
      varianceThreshold: 5,
    });

    expect(report.samples[0]?.withinRange).toBe(true);
    expect(report.samples[0]?.consistent).toBe(false);
    expect(report.warnings.some((w) => w.includes('inconsistent'))).toBe(true);
    expect(report.passRate).toBe(0);
  });

  it('runs each sample the configured number of times', async () => {
    const adapter = scoreQueueAdapter([90, 90, 90, 90, 90]);
    await runBiasHarness({ questions, rubric, adapter }, samples, { runs: 5 });
    expect(adapter.complete).toHaveBeenCalledTimes(5);
  });

  it('throws CliConfigError when a sample references an unknown question id', async () => {
    const adapter = scoreQueueAdapter([90]);
    const badSamples: BiasSample[] = [
      { questionId: 'does-not-exist', answerText: 'x', expectedScoreRange: [0, 100] },
    ];
    await expect(runBiasHarness({ questions, rubric, adapter }, badSamples)).rejects.toThrow(
      CliConfigError,
    );
  });
});

describe('loadBiasHarnessSamples', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'interview-sdk-cli-samples-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loads a valid JSON sample set', async () => {
    const file = join(dir, 'samples.json');
    await writeFile(
      file,
      JSON.stringify([{ questionId: 'q1', answerText: 'buckets', expectedScoreRange: [80, 100] }]),
    );
    const samples = await loadBiasHarnessSamples(file);
    expect(samples).toHaveLength(1);
    expect(samples[0]?.questionId).toBe('q1');
  });

  it('loads a valid YAML sample set', async () => {
    const file = join(dir, 'samples.yaml');
    await writeFile(
      file,
      '- questionId: q1\n  answerText: buckets\n  expectedScoreRange: [80, 100]\n',
    );
    const samples = await loadBiasHarnessSamples(file);
    expect(samples).toHaveLength(1);
  });

  it('throws CliConfigError for a sample missing expectedScoreRange', async () => {
    const file = join(dir, 'invalid.json');
    await writeFile(file, JSON.stringify([{ questionId: 'q1', answerText: 'buckets' }]));
    await expect(loadBiasHarnessSamples(file)).rejects.toThrow(CliConfigError);
  });

  it('throws CliConfigError for a non-array sample file', async () => {
    const file = join(dir, 'not-array.json');
    await writeFile(file, JSON.stringify({ questionId: 'q1' }));
    await expect(loadBiasHarnessSamples(file)).rejects.toThrow(CliConfigError);
  });
});
