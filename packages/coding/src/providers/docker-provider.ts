import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UnsupportedLanguageError } from '../errors.js';
import type { CodeExecutionProvider, CodeExecutionRequest, CodeExecutionResult } from '../types.js';

export interface LanguageRuntimeConfig {
  /** Docker image with the language runtime pre-installed. */
  image: string;
  fileName: string;
  runCommand: (fileName: string) => string[];
}

export const DEFAULT_LANGUAGE_RUNTIMES: Record<string, LanguageRuntimeConfig> = {
  javascript: {
    image: 'node:20-alpine',
    fileName: 'main.js',
    runCommand: (file) => ['node', file],
  },
  python: {
    image: 'python:3.12-alpine',
    fileName: 'main.py',
    runCommand: (file) => ['python3', file],
  },
};

export type SpawnFn = (command: string, args: string[]) => ChildProcess;

/** Schedules `callback` after `ms` and returns a function that cancels it. */
export type ScheduleTimeout = (callback: () => void, ms: number) => () => void;

const defaultScheduleTimeout: ScheduleTimeout = (callback, ms) => {
  const timer = setTimeout(callback, ms);
  return () => clearTimeout(timer);
};

export interface DockerCodeExecutionProviderConfig {
  languages?: Record<string, LanguageRuntimeConfig>;
  /** Injectable for testing — defaults to node:child_process's real `spawn`. */
  spawnImpl?: SpawnFn;
  /** Injectable for testing, so the timeout path can be triggered without a real wall-clock wait. */
  scheduleTimeout?: ScheduleTimeout;
  defaultTimeoutMs?: number;
  defaultMemoryLimitMb?: number;
  maxOutputBytes?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MEMORY_LIMIT_MB = 256;
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;

/**
 * Default sandbox: shells out to `docker run` for genuine OS-level
 * isolation. `vm2` and Node's built-in `vm` module are deliberately not
 * used here — both are documented as escapable and not real security
 * boundaries for untrusted code (§16).
 *
 * Every container runs with `--network=none`, a read-only root filesystem
 * (a small writable `/tmp` tmpfs for language runtimes that need it),
 * memory/CPU/process-count limits, and as a non-root user. The candidate's
 * source is written to a host temp file and bind-mounted read-only, rather
 * than piped in, to avoid shell-escaping the code itself.
 */
export class DockerCodeExecutionProvider implements CodeExecutionProvider {
  readonly id = 'docker';
  readonly supportedLanguages: string[];
  private readonly languages: Record<string, LanguageRuntimeConfig>;
  private readonly spawnImpl: SpawnFn;
  private readonly scheduleTimeout: ScheduleTimeout;
  private readonly defaultTimeoutMs: number;
  private readonly defaultMemoryLimitMb: number;
  private readonly maxOutputBytes: number;

  constructor(config: DockerCodeExecutionProviderConfig = {}) {
    this.languages = config.languages ?? DEFAULT_LANGUAGE_RUNTIMES;
    this.supportedLanguages = Object.keys(this.languages);
    this.spawnImpl = config.spawnImpl ?? spawn;
    this.scheduleTimeout = config.scheduleTimeout ?? defaultScheduleTimeout;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultMemoryLimitMb = config.defaultMemoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB;
    this.maxOutputBytes = config.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  }

  async execute(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    const runtime = this.languages[request.language];
    if (!runtime) {
      throw new UnsupportedLanguageError(
        `No Docker runtime configured for language "${request.language}". Supported: ${this.supportedLanguages.join(', ')}.`,
      );
    }

    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    const memoryLimitMb = request.memoryLimitMb ?? this.defaultMemoryLimitMb;

    const dir = await mkdtemp(join(tmpdir(), 'interview-sdk-sandbox-'));
    const hostFilePath = join(dir, runtime.fileName);
    await writeFile(hostFilePath, request.code, 'utf8');

    try {
      return await this.runContainer(
        runtime,
        hostFilePath,
        request.stdin ?? '',
        timeoutMs,
        memoryLimitMb,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private runContainer(
    runtime: LanguageRuntimeConfig,
    hostFilePath: string,
    stdin: string,
    timeoutMs: number,
    memoryLimitMb: number,
  ): Promise<CodeExecutionResult> {
    const containerName = `interview-sdk-${randomUUID()}`;
    const args = [
      'run',
      '--rm',
      '--name',
      containerName,
      '--network',
      'none',
      '--read-only',
      '--tmpfs',
      '/tmp:rw,size=16m',
      '--memory',
      `${memoryLimitMb}m`,
      '--memory-swap',
      `${memoryLimitMb}m`,
      '--cpus',
      '1',
      '--pids-limit',
      '64',
      '--user',
      'nobody',
      '-v',
      `${hostFilePath}:/sandbox/${runtime.fileName}:ro`,
      '-w',
      '/sandbox',
      '-i',
      runtime.image,
      ...runtime.runCommand(runtime.fileName),
    ];

    return new Promise((resolve, reject) => {
      const start = Date.now();
      const child = this.spawnImpl('docker', args);

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let settled = false;

      const cancelTimeout = this.scheduleTimeout(() => {
        timedOut = true;
        // Killing the `docker run` CLI process alone would not stop the
        // container (the CLI just proxies it) — kill the container itself.
        this.spawnImpl('docker', ['kill', containerName]);
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => {
        if (stdout.length < this.maxOutputBytes) stdout += chunk.toString('utf8');
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        if (stderr.length < this.maxOutputBytes) stderr += chunk.toString('utf8');
      });

      child.on('error', (error: Error) => {
        if (settled) return;
        settled = true;
        cancelTimeout();
        reject(error);
      });

      child.on('close', (exitCode: number | null) => {
        if (settled) return;
        settled = true;
        cancelTimeout();
        const durationMs = Date.now() - start;
        // Docker's OOM killer exits the container with 137 (128+SIGKILL).
        // Our own timeout kill also produces 137, so only attribute it to
        // memory when we didn't request the kill ourselves.
        const memoryExceeded = !timedOut && exitCode === 137;
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode,
          timedOut,
          durationMs,
          memoryExceeded,
        });
      });

      if (child.stdin) {
        child.stdin.write(stdin);
        child.stdin.end();
      }
    });
  }
}
