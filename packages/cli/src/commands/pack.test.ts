import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliConfigError } from '../errors.js';
import { createQuestionPackFile, validateQuestionPackFile } from './pack.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'interview-sdk-cli-pack-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('validateQuestionPackFile', () => {
  it('validates a well-formed pack file', async () => {
    const file = join(dir, 'pack.json');
    await writeFile(
      file,
      JSON.stringify({
        name: 'dsa',
        questions: [{ id: 'q1', prompt: 'Explain hash maps.' }],
        rubric: [{ id: 'technical', label: 'Technical', weight: 1 }],
      }),
    );
    const result = await validateQuestionPackFile(file);
    expect(result.valid).toBe(true);
  });

  it('reports issues for a malformed pack file', async () => {
    const file = join(dir, 'bad-pack.json');
    await writeFile(file, JSON.stringify({ name: 'dsa', questions: [] }));
    const result = await validateQuestionPackFile(file);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('createQuestionPackFile', () => {
  it('writes a starter pack that itself validates cleanly', async () => {
    const file = join(dir, 'starter.json');
    await createQuestionPackFile(file, 'my-pack');

    const written = JSON.parse(await readFile(file, 'utf8'));
    expect(written.name).toBe('my-pack');
    const result = await validateQuestionPackFile(file);
    expect(result.valid).toBe(true);
  });

  it('refuses to overwrite an existing file without force', async () => {
    const file = join(dir, 'starter.json');
    await createQuestionPackFile(file, 'my-pack');
    await expect(createQuestionPackFile(file, 'my-pack')).rejects.toThrow(CliConfigError);
  });

  it('overwrites when force is set', async () => {
    const file = join(dir, 'starter.json');
    await createQuestionPackFile(file, 'my-pack');
    await createQuestionPackFile(file, 'renamed-pack', { force: true });

    const written = JSON.parse(await readFile(file, 'utf8'));
    expect(written.name).toBe('renamed-pack');
  });
});
