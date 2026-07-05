import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fileExists } from './fs-utils.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'interview-sdk-cli-fs-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('fileExists', () => {
  it('returns true for a file that exists', async () => {
    const file = join(dir, 'present.txt');
    await writeFile(file, 'hi');
    expect(await fileExists(file)).toBe(true);
  });

  it('returns false for a file that does not exist', async () => {
    expect(await fileExists(join(dir, 'absent.txt'))).toBe(false);
  });
});
