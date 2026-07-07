import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from './cli.js';

let dir: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'interview-sdk-cli-bin-'));
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

function output(): string {
  return logSpy.mock.calls.map((call: unknown[]) => call.join(' ')).join('\n');
}

const wellBehavedConfigSource = `
export default {
  questions: [{ id: 'q1', prompt: 'Explain hash maps.', concepts: ['hashing'] }],
  rubric: [{ id: 'technical', label: 'Technical', weight: 1 }],
  maxFollowUpDepth: 0,
  adapter: {
    id: 'fake',
    complete: async (request) => {
      const text = request.messages.at(-1)?.content ?? '';
      if (text.includes('hashing')) {
        return { text: JSON.stringify({ dimensionScores: { technical: 92 }, conceptCoverage: [{ concept: 'hashing', covered: true }] }) };
      }
      return { text: JSON.stringify({ dimensionScores: { technical: 90 } }) };
    },
  },
};
`;

describe('main — top level', () => {
  it('prints help and returns 0 with no command', async () => {
    expect(await main([])).toBe(0);
    expect(output()).toContain('Usage:');
  });

  it('prints the version and returns 0 for --version', async () => {
    expect(await main(['--version'])).toBe(0);
    expect(output()).toContain('@interview-sdk/cli@');
  });

  it('returns 1 and prints an error for an unknown command', async () => {
    expect(await main(['bogus'])).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
  });
});

describe('main — init', () => {
  it('scaffolds a server route and returns 0', async () => {
    expect(await main(['init', '--dir', dir])).toBe(0);
    expect(output()).toContain('route.ts');
  });

  it('returns 1 the second time without --force', async () => {
    await main(['init', '--dir', dir]);
    expect(await main(['init', '--dir', dir])).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('already exists'));
  });

  it('warns about the missing stylesheet import when no root layout exists yet', async () => {
    expect(await main(['init', '--dir', dir])).toBe(0);
    expect(output()).toContain('styles.css');
  });
});

describe('main — simulate', () => {
  it('returns 1 when --config is missing', async () => {
    expect(await main(['simulate'])).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('--config'));
  });

  it('runs the requested persona and returns 0 for a well-behaved adapter', async () => {
    const configPath = join(dir, 'interview.config.mjs');
    await writeFile(configPath, wellBehavedConfigSource);

    const code = await main(['simulate', '--config', configPath, '--persona', 'strong']);

    expect(code).toBe(0);
    expect(output()).toContain('Strong answer (strong)');
  });

  it('outputs JSON when --json is passed', async () => {
    const configPath = join(dir, 'interview.config.mjs');
    await writeFile(configPath, wellBehavedConfigSource);

    await main(['simulate', '--config', configPath, '--persona', 'strong', '--json']);

    expect(() => JSON.parse(output())).not.toThrow();
  });
});

describe('main — bias-harness', () => {
  it('returns 1 when --samples is missing', async () => {
    const configPath = join(dir, 'interview.config.mjs');
    await writeFile(configPath, wellBehavedConfigSource);
    expect(await main(['bias-harness', '--config', configPath])).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('--samples'));
  });

  it('runs samples against the config and reports pass rate', async () => {
    const configPath = join(dir, 'interview.config.mjs');
    await writeFile(configPath, wellBehavedConfigSource);
    const samplesPath = join(dir, 'samples.json');
    await writeFile(
      samplesPath,
      JSON.stringify([
        { questionId: 'q1', answerText: 'buckets and hashing', expectedScoreRange: [80, 100] },
      ]),
    );

    const code = await main([
      'bias-harness',
      '--config',
      configPath,
      '--samples',
      samplesPath,
      '--runs',
      '2',
    ]);

    expect(code).toBe(0);
    expect(output()).toContain('Pass rate: 100%');
  });

  it('rejects a non-numeric --runs flag', async () => {
    const configPath = join(dir, 'interview.config.mjs');
    await writeFile(configPath, wellBehavedConfigSource);
    const samplesPath = join(dir, 'samples.json');
    await writeFile(
      samplesPath,
      JSON.stringify([{ questionId: 'q1', answerText: 'x', expectedScoreRange: [0, 100] }]),
    );

    const code = await main([
      'bias-harness',
      '--config',
      configPath,
      '--samples',
      samplesPath,
      '--runs',
      'not-a-number',
    ]);
    expect(code).toBe(1);
  });
});

describe('main — pack', () => {
  it('validates a well-formed pack file and returns 0', async () => {
    const packPath = join(dir, 'pack.json');
    await writeFile(
      packPath,
      JSON.stringify({
        name: 'dsa',
        questions: [{ id: 'q1', prompt: 'x' }],
        rubric: [{ id: 'technical', label: 'Technical', weight: 1 }],
      }),
    );
    expect(await main(['pack', 'validate', packPath])).toBe(0);
    expect(output()).toContain('valid');
  });

  it('scaffolds a starter pack and returns 0', async () => {
    const packPath = join(dir, 'starter.json');
    expect(await main(['pack', 'init', 'my-pack', packPath])).toBe(0);
    expect(output()).toContain('Wrote');
  });

  it('returns 1 for an unknown pack subcommand', async () => {
    expect(await main(['pack', 'nonexistent'])).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown pack subcommand'));
  });
});
