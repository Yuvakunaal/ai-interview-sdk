import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliConfigError } from './errors.js';
import { loadStructuredFile } from './structured-file.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'interview-sdk-cli-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('loadStructuredFile', () => {
  it('parses a .json file', async () => {
    const file = join(dir, 'data.json');
    await writeFile(file, JSON.stringify({ hello: 'world' }));
    expect(await loadStructuredFile(file)).toEqual({ hello: 'world' });
  });

  it('parses a .yaml file', async () => {
    const file = join(dir, 'data.yaml');
    await writeFile(file, 'hello: world\ncount: 3\n');
    expect(await loadStructuredFile(file)).toEqual({ hello: 'world', count: 3 });
  });

  it('parses a .yml file the same as .yaml', async () => {
    const file = join(dir, 'data.yml');
    await writeFile(file, 'hello: world\n');
    expect(await loadStructuredFile(file)).toEqual({ hello: 'world' });
  });

  it('throws CliConfigError for a missing file', async () => {
    await expect(loadStructuredFile(join(dir, 'nope.json'))).rejects.toThrow(CliConfigError);
  });

  it('throws CliConfigError for malformed JSON', async () => {
    const file = join(dir, 'bad.json');
    await writeFile(file, '{not json');
    await expect(loadStructuredFile(file)).rejects.toThrow(CliConfigError);
  });

  it('throws CliConfigError for malformed YAML', async () => {
    const file = join(dir, 'bad.yaml');
    await writeFile(file, '"unterminated: [oops\n');
    await expect(loadStructuredFile(file)).rejects.toThrow(CliConfigError);
  });
});
