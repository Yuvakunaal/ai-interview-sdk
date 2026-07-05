import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CliConfigError, CliUsageError } from '../errors.js';
import { scaffoldServerRoute } from './init.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'interview-sdk-cli-init-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('scaffoldServerRoute', () => {
  it('writes a Next.js route handler by default', async () => {
    const result = await scaffoldServerRoute({ dir });
    expect(result.filesWritten).toHaveLength(1);
    expect(result.filesWritten[0]).toBe(join(dir, 'app/api/interview/answer/route.ts'));

    const content = await readFile(result.filesWritten[0]!, 'utf8');
    expect(content).toContain('createInterviewAnswerHandler');
    expect(content).toContain('@interview-sdk/server');
  });

  it('writes a standalone Node server file for framework: node', async () => {
    const result = await scaffoldServerRoute({ dir, framework: 'node' });
    expect(result.filesWritten[0]).toBe(join(dir, 'interview-server.mjs'));

    const content = await readFile(result.filesWritten[0]!, 'utf8');
    expect(content).toContain('createServer');
  });

  it('creates nested directories as needed', async () => {
    const result = await scaffoldServerRoute({ dir });
    await expect(readFile(result.filesWritten[0]!, 'utf8')).resolves.toBeTruthy();
  });

  it('refuses to overwrite an existing file without --force', async () => {
    await scaffoldServerRoute({ dir });
    await expect(scaffoldServerRoute({ dir })).rejects.toThrow(CliConfigError);
  });

  it('overwrites an existing file when force is set', async () => {
    const first = await scaffoldServerRoute({ dir });
    await writeFile(first.filesWritten[0]!, '// tampered');
    await scaffoldServerRoute({ dir, force: true });

    const content = await readFile(first.filesWritten[0]!, 'utf8');
    expect(content).toContain('createInterviewAnswerHandler');
  });

  it('throws CliUsageError for an unknown framework', async () => {
    await expect(scaffoldServerRoute({ dir, framework: 'django' as never })).rejects.toThrow(
      CliUsageError,
    );
  });
});
