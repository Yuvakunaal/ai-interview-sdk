import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
    expect(result.filesWritten).toHaveLength(2);
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

  it('also writes a .env.example alongside the route, listing the env vars the route reads', async () => {
    const result = await scaffoldServerRoute({ dir });
    expect(result.filesWritten[1]).toBe(join(dir, '.env.example'));

    const content = await readFile(result.filesWritten[1]!, 'utf8');
    expect(content).toContain('INTERVIEW_SIGNING_SECRET=');
    expect(content).toContain('OPENAI_API_KEY=');
  });

  it('refuses to overwrite an existing .env.example without --force', async () => {
    await scaffoldServerRoute({ dir });
    await rm(join(dir, 'app'), { recursive: true, force: true }); // route file gone, .env.example remains
    await expect(scaffoldServerRoute({ dir })).rejects.toThrow(CliConfigError);
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

  describe('stylesheet import (nextjs)', () => {
    it('prepends the required stylesheet import to an existing app/layout.tsx', async () => {
      const layoutPath = join(dir, 'app/layout.tsx');
      await mkdir(join(dir, 'app'), { recursive: true });
      const original = `export default function RootLayout({ children }) {\n  return <html><body>{children}</body></html>;\n}\n`;
      await writeFile(layoutPath, original);

      const result = await scaffoldServerRoute({ dir });

      const content = await readFile(layoutPath, 'utf8');
      expect(content).toContain("import '@interview-sdk/react/styles.css';");
      // The developer's own layout content must survive untouched below the new import.
      expect(content).toContain(original);
      expect(result.filesWritten).toContain(layoutPath);
    });

    it('also finds src/app/layout.tsx', async () => {
      const layoutPath = join(dir, 'src/app/layout.tsx');
      await mkdir(join(dir, 'src/app'), { recursive: true });
      await writeFile(layoutPath, 'export default function RootLayout() { return null; }\n');

      const result = await scaffoldServerRoute({ dir });

      const content = await readFile(layoutPath, 'utf8');
      expect(content).toContain("import '@interview-sdk/react/styles.css';");
      expect(result.filesWritten).toContain(layoutPath);
    });

    it('does not duplicate the import, or report the file as written, if it is already present', async () => {
      const layoutPath = join(dir, 'app/layout.tsx');
      await mkdir(join(dir, 'app'), { recursive: true });
      const original = `import '@interview-sdk/react/styles.css';\n\nexport default function RootLayout() { return null; }\n`;
      await writeFile(layoutPath, original);

      const result = await scaffoldServerRoute({ dir });

      const content = await readFile(layoutPath, 'utf8');
      expect(content).toBe(original);
      expect(result.filesWritten).not.toContain(layoutPath);
    });

    it('warns instead of failing when no root layout file exists yet', async () => {
      const result = await scaffoldServerRoute({ dir });

      expect(result.warnings.some((w) => w.includes('styles.css'))).toBe(true);
    });

    it('does not attempt stylesheet wiring for framework: node (no HTML layout exists)', async () => {
      const result = await scaffoldServerRoute({ dir, framework: 'node' });

      expect(result.warnings).toHaveLength(0);
    });
  });
});
