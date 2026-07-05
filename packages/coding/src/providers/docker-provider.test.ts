import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { UnsupportedLanguageError } from '../errors.js';
import { DockerCodeExecutionProvider } from './docker-provider.js';

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = { write: vi.fn(), end: vi.fn() };

  close(code: number | null): void {
    this.emit('close', code);
  }
}

function fakeSpawn(children: FakeChildProcess[]): {
  spawnImpl: (command: string, args: string[]) => ChildProcess;
  calls: { command: string; args: string[] }[];
} {
  const calls: { command: string; args: string[] }[] = [];
  let call = 0;
  const spawnImpl = (command: string, args: string[]): ChildProcess => {
    calls.push({ command, args });
    const child = children[Math.min(call, children.length - 1)]!;
    call += 1;
    return child as unknown as ChildProcess;
  };
  return { spawnImpl, calls };
}

/**
 * Waits for the real fs.promises calls inside `execute()` (mkdtemp,
 * writeFile) to settle and `spawnImpl` to actually be invoked, before the
 * test drives the fake child — otherwise events emitted on the child race
 * ahead of the provider attaching its listeners.
 */
function waitForSpawn(calls: unknown[]): Promise<void> {
  return vi.waitFor(() => {
    if (calls.length === 0) throw new Error('spawnImpl has not been called yet');
  });
}

/** A controllable fake `scheduleTimeout`: `fire()` invokes the most recently scheduled callback synchronously. */
function fakeTimers(): {
  scheduleTimeout: (callback: () => void, ms: number) => () => void;
  fire: () => void;
  scheduledMs: number[];
} {
  let pending: (() => void) | undefined;
  const scheduledMs: number[] = [];
  return {
    scheduleTimeout: (callback, ms) => {
      pending = callback;
      scheduledMs.push(ms);
      return () => {
        pending = undefined;
      };
    },
    fire: () => {
      pending?.();
    },
    scheduledMs,
  };
}

describe('DockerCodeExecutionProvider', () => {
  it('runs javascript and returns stdout on a successful exit', async () => {
    const child = new FakeChildProcess();
    const { spawnImpl, calls } = fakeSpawn([child]);
    const provider = new DockerCodeExecutionProvider({ spawnImpl });

    const resultPromise = provider.execute({ language: 'javascript', code: "console.log('hi')" });
    await waitForSpawn(calls);
    child.stdout.emit('data', Buffer.from('hi\n'));
    child.close(0);

    const result = await resultPromise;
    expect(result.stdout).toBe('hi');
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.memoryExceeded).toBe(false);
  });

  it('captures stderr and a non-zero exit code as a runtime error', async () => {
    const child = new FakeChildProcess();
    const { spawnImpl, calls } = fakeSpawn([child]);
    const provider = new DockerCodeExecutionProvider({ spawnImpl });

    const resultPromise = provider.execute({
      language: 'python',
      code: 'raise ValueError("boom")',
    });
    await waitForSpawn(calls);
    child.stderr.emit('data', Buffer.from('ValueError: boom\n'));
    child.close(1);

    const result = await resultPromise;
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('ValueError');
  });

  it('kills the container and reports timedOut once the timer fires', async () => {
    const runChild = new FakeChildProcess();
    const killChild = new FakeChildProcess();
    const { spawnImpl, calls } = fakeSpawn([runChild, killChild]);
    const timers = fakeTimers();
    const provider = new DockerCodeExecutionProvider({
      spawnImpl,
      scheduleTimeout: timers.scheduleTimeout,
    });

    const resultPromise = provider.execute({
      language: 'javascript',
      code: 'while (true) {}',
      timeoutMs: 1234,
    });
    await waitForSpawn(calls);

    timers.fire();
    expect(timers.scheduledMs).toEqual([1234]);
    expect(calls[1]?.args).toEqual(expect.arrayContaining(['kill']));

    // Simulate docker actually killing the run container after our kill call.
    runChild.close(137);

    const result = await resultPromise;
    expect(result.timedOut).toBe(true);
    expect(result.memoryExceeded).toBe(false);
  });

  it('reports memoryExceeded for an untimed exit code 137', async () => {
    const child = new FakeChildProcess();
    const { spawnImpl, calls } = fakeSpawn([child]);
    const timers = fakeTimers();
    const provider = new DockerCodeExecutionProvider({
      spawnImpl,
      scheduleTimeout: timers.scheduleTimeout,
    });

    const resultPromise = provider.execute({
      language: 'javascript',
      code: 'const a = new Array(1e9);',
    });
    await waitForSpawn(calls);
    child.close(137);

    const result = await resultPromise;
    expect(result.memoryExceeded).toBe(true);
    expect(result.timedOut).toBe(false);
  });

  it('rejects with UnsupportedLanguageError without spawning for an unconfigured language', async () => {
    const { spawnImpl, calls } = fakeSpawn([new FakeChildProcess()]);
    const provider = new DockerCodeExecutionProvider({ spawnImpl });

    await expect(provider.execute({ language: 'cobol', code: 'x' })).rejects.toThrow(
      UnsupportedLanguageError,
    );
    expect(calls).toHaveLength(0);
  });

  it('truncates captured output beyond maxOutputBytes', async () => {
    const child = new FakeChildProcess();
    const { spawnImpl, calls } = fakeSpawn([child]);
    const provider = new DockerCodeExecutionProvider({ spawnImpl, maxOutputBytes: 5 });

    const resultPromise = provider.execute({ language: 'javascript', code: 'x' });
    await waitForSpawn(calls);
    child.stdout.emit('data', Buffer.from('123456789'));
    child.stdout.emit('data', Buffer.from('more-data-that-should-not-be-appended'));
    child.close(0);

    const result = await resultPromise;
    expect(result.stdout.length).toBeLessThanOrEqual(9);
  });

  it('passes the expected Docker security flags', async () => {
    const child = new FakeChildProcess();
    const { spawnImpl, calls } = fakeSpawn([child]);
    const provider = new DockerCodeExecutionProvider({ spawnImpl });

    const resultPromise = provider.execute({ language: 'javascript', code: 'x' });
    await waitForSpawn(calls);
    child.close(0);
    await resultPromise;

    const runArgs = calls[0]!.args;
    expect(runArgs).toEqual(
      expect.arrayContaining([
        '--network',
        'none',
        '--read-only',
        '--user',
        'nobody',
        '--pids-limit',
        '64',
      ]),
    );
  });

  it('writes stdin to the container process', async () => {
    const child = new FakeChildProcess();
    const { spawnImpl, calls } = fakeSpawn([child]);
    const provider = new DockerCodeExecutionProvider({ spawnImpl });

    const resultPromise = provider.execute({
      language: 'javascript',
      code: 'x',
      stdin: 'hello-input',
    });
    await waitForSpawn(calls);
    child.close(0);
    await resultPromise;

    expect(child.stdin.write).toHaveBeenCalledWith('hello-input');
    expect(child.stdin.end).toHaveBeenCalled();
  });

  it('rejects when the spawned process itself errors (e.g. docker not installed)', async () => {
    const child = new FakeChildProcess();
    const { spawnImpl, calls } = fakeSpawn([child]);
    const provider = new DockerCodeExecutionProvider({ spawnImpl });

    const resultPromise = provider.execute({ language: 'javascript', code: 'x' });
    await waitForSpawn(calls);
    child.emit('error', new Error('spawn docker ENOENT'));

    await expect(resultPromise).rejects.toThrow('spawn docker ENOENT');
  });

  it('exposes supportedLanguages from the configured runtime map', () => {
    const provider = new DockerCodeExecutionProvider();
    expect(provider.supportedLanguages).toEqual(expect.arrayContaining(['javascript', 'python']));
  });
});
