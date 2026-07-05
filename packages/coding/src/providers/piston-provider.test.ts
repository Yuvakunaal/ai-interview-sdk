import { describe, expect, it, vi } from 'vitest';
import { SandboxUnavailableError, UnsupportedLanguageError } from '../errors.js';
import { PistonCodeExecutionProvider } from './piston-provider.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('PistonCodeExecutionProvider', () => {
  it('sends the expected request shape and parses a successful run', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        language: 'python',
        version: '3.10.0',
        run: { stdout: 'hi\n', stderr: '', code: 0, signal: null, output: 'hi\n' },
      }),
    );
    const provider = new PistonCodeExecutionProvider({ fetchImpl });

    const result = await provider.execute({
      language: 'python',
      code: "print('hi')",
      stdin: 'unused',
      timeoutMs: 3000,
      memoryLimitMb: 128,
    });

    expect(result.stdout).toBe('hi\n');
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://emkc.org/api/v2/piston/execute');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      language: 'python',
      version: '3.10.0',
      files: [{ content: "print('hi')" }],
      stdin: 'unused',
      run_timeout: 3000,
      run_memory_limit: 128 * 1024 * 1024,
    });
  });

  it('throws UnsupportedLanguageError without fetching for an unconfigured language', async () => {
    const fetchImpl = vi.fn();
    const provider = new PistonCodeExecutionProvider({ fetchImpl });

    await expect(provider.execute({ language: 'cobol', code: 'x' })).rejects.toThrow(
      UnsupportedLanguageError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws SandboxUnavailableError when the network request fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('fetch failed');
    });
    const provider = new PistonCodeExecutionProvider({ fetchImpl });

    await expect(provider.execute({ language: 'python', code: 'x' })).rejects.toThrow(
      SandboxUnavailableError,
    );
  });

  it('throws SandboxUnavailableError for a non-ok HTTP response (e.g. the public instance is whitelist-gated)', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: 'Public Piston API is now whitelist only' }, 403),
    );
    const provider = new PistonCodeExecutionProvider({ fetchImpl });

    await expect(provider.execute({ language: 'python', code: 'x' })).rejects.toThrow(
      SandboxUnavailableError,
    );
  });

  it('reports a compile failure distinctly from a runtime error', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        language: 'typescript',
        version: '5.0.3',
        compile: {
          stdout: '',
          stderr: 'TS2304: Cannot find name.',
          code: 1,
          signal: null,
          output: '',
        },
        run: { stdout: '', stderr: '', code: null, signal: null, output: '' },
      }),
    );
    const provider = new PistonCodeExecutionProvider({
      fetchImpl,
      languageVersions: { typescript: '5.0.3' },
    });

    const result = await provider.execute({
      language: 'typescript',
      code: 'const x: number = "oops";',
    });

    expect(result.compileError).toContain('TS2304');
    expect(result.exitCode).toBe(1);
  });

  it('falls back to compile output when compile stderr is empty', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        language: 'typescript',
        version: '5.0.3',
        compile: {
          stdout: '',
          stderr: '',
          code: 1,
          signal: null,
          output: 'error TS2304 in combined output',
        },
        run: { stdout: '', stderr: '', code: null, signal: null, output: '' },
      }),
    );
    const provider = new PistonCodeExecutionProvider({
      fetchImpl,
      languageVersions: { typescript: '5.0.3' },
    });

    const result = await provider.execute({ language: 'typescript', code: 'bad code' });
    expect(result.compileError).toBe('error TS2304 in combined output');
  });

  it('treats a SIGKILL run signal as a timeout', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        language: 'python',
        version: '3.10.0',
        run: { stdout: '', stderr: '', code: null, signal: 'SIGKILL', output: '' },
      }),
    );
    const provider = new PistonCodeExecutionProvider({ fetchImpl });

    const result = await provider.execute({ language: 'python', code: 'while True: pass' });
    expect(result.timedOut).toBe(true);
  });

  it('uses a custom baseUrl and languageVersions when provided', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({
        language: 'python',
        version: '3.11.0',
        run: { stdout: '', stderr: '', code: 0, signal: null, output: '' },
      }),
    );
    const provider = new PistonCodeExecutionProvider({
      fetchImpl,
      baseUrl: 'https://my-piston.example.com',
      languageVersions: { python: '3.11.0' },
    });

    await provider.execute({ language: 'python', code: 'x' });

    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://my-piston.example.com/execute');
  });

  it('exposes supportedLanguages from the configured version map', () => {
    const provider = new PistonCodeExecutionProvider();
    expect(provider.supportedLanguages).toEqual(expect.arrayContaining(['javascript', 'python']));
  });
});
