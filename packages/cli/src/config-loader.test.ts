import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliConfigError } from './errors.js';
import { loadInterviewCliConfig } from './config-loader.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'interview-sdk-cli-config-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const validConfigSource = `
export default {
  questions: [{ id: 'q1', prompt: 'Explain hash maps.', concepts: ['hashing'] }],
  rubric: [{ id: 'technical', label: 'Technical', weight: 1 }],
  adapter: { id: 'fake', complete: async () => ({ text: '{}' }) },
};
`;

describe('loadInterviewCliConfig', () => {
  it('loads a valid config file via dynamic import', async () => {
    const file = join(dir, 'interview.config.mjs');
    await writeFile(file, validConfigSource);

    const config = await loadInterviewCliConfig(file);

    expect(config.questions).toHaveLength(1);
    expect(config.rubric).toHaveLength(1);
    expect(config.adapter.id).toBe('fake');
  });

  it('throws CliConfigError when the file does not exist', async () => {
    await expect(loadInterviewCliConfig(join(dir, 'nope.mjs'))).rejects.toThrow(CliConfigError);
  });

  it('throws CliConfigError when the default export is missing required fields', async () => {
    const file = join(dir, 'bad.mjs');
    await writeFile(file, 'export default { questions: [] };');
    await expect(loadInterviewCliConfig(file)).rejects.toThrow(CliConfigError);
  });

  it('throws CliConfigError (via validateInterviewConfig) for an empty question bank', async () => {
    const file = join(dir, 'empty-questions.mjs');
    await writeFile(
      file,
      `export default {
        questions: [],
        rubric: [{ id: 'technical', label: 'Technical', weight: 1 }],
        adapter: { id: 'fake', complete: async () => ({ text: '{}' }) },
      };`,
    );
    await expect(loadInterviewCliConfig(file)).rejects.toThrow(/Invalid interview configuration/);
  });

  it('throws CliConfigError when the module has a syntax error', async () => {
    const file = join(dir, 'syntax-error.mjs');
    await writeFile(file, 'export default {{{ not valid js');
    await expect(loadInterviewCliConfig(file)).rejects.toThrow(CliConfigError);
  });
});
