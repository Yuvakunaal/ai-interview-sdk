import { SandboxUnavailableError, UnsupportedLanguageError } from '../errors.js';
import type { CodeExecutionProvider, CodeExecutionRequest, CodeExecutionResult } from '../types.js';

export interface PistonCodeExecutionProviderConfig {
  /**
   * Base URL of a Piston instance (no trailing `/execute`). Piston's public
   * instance went whitelist-only in 2026 — self-host your own (Piston ships
   * as a single Docker image built for exactly this) and point this at it.
   * Defaults to the public URL only so the request shape is correct
   * out of the box; it will 403 until you supply your own instance or get
   * whitelisted.
   */
  baseUrl?: string;
  /** Maps a language id to the exact Piston `version` string to request — Piston requires an exact match, not "latest". */
  languageVersions?: Record<string, string>;
  fetchImpl?: typeof fetch;
  defaultTimeoutMs?: number;
  defaultMemoryLimitMb?: number;
}

const DEFAULT_BASE_URL = 'https://emkc.org/api/v2/piston';
const DEFAULT_LANGUAGE_VERSIONS: Record<string, string> = {
  javascript: '18.15.0',
  python: '3.10.0',
};
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MEMORY_LIMIT_MB = 256;

interface PistonStageResult {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
  output: string;
}

interface PistonExecuteResponse {
  language: string;
  version: string;
  run: PistonStageResult;
  compile?: PistonStageResult;
}

/**
 * A hosted-sandbox alternative to `DockerCodeExecutionProvider`, for
 * developers without Docker (e.g. serverless functions that can't spawn
 * containers). Implements the same `CodeExecutionProvider` interface, so
 * it's a drop-in swap — this is what the pluggable provider design is for.
 */
export class PistonCodeExecutionProvider implements CodeExecutionProvider {
  readonly id = 'piston';
  readonly supportedLanguages: string[];
  private readonly baseUrl: string;
  private readonly languageVersions: Record<string, string>;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultTimeoutMs: number;
  private readonly defaultMemoryLimitMb: number;

  constructor(config: PistonCodeExecutionProviderConfig = {}) {
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.languageVersions = config.languageVersions ?? DEFAULT_LANGUAGE_VERSIONS;
    this.supportedLanguages = Object.keys(this.languageVersions);
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultMemoryLimitMb = config.defaultMemoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB;
  }

  async execute(request: CodeExecutionRequest): Promise<CodeExecutionResult> {
    const version = this.languageVersions[request.language];
    if (!version) {
      throw new UnsupportedLanguageError(
        `No Piston version configured for language "${request.language}". Supported: ${this.supportedLanguages.join(', ')}.`,
      );
    }

    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    const memoryLimitBytes = (request.memoryLimitMb ?? this.defaultMemoryLimitMb) * 1024 * 1024;

    let response: Response;
    const start = Date.now();
    try {
      response = await this.fetchImpl(`${this.baseUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: request.language,
          version,
          files: [{ content: request.code }],
          stdin: request.stdin ?? '',
          run_timeout: timeoutMs,
          compile_timeout: timeoutMs,
          run_memory_limit: memoryLimitBytes,
          compile_memory_limit: memoryLimitBytes,
        }),
      });
    } catch (error) {
      throw new SandboxUnavailableError(
        `Could not reach the Piston instance at "${this.baseUrl}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new SandboxUnavailableError(
        `Piston responded with ${response.status} ${response.statusText}${text ? `: ${text}` : ''}`,
      );
    }

    const data = (await response.json()) as PistonExecuteResponse;
    const durationMs = Date.now() - start;

    if (data.compile && data.compile.code !== 0) {
      return {
        stdout: data.compile.stdout,
        stderr: data.compile.stderr,
        exitCode: data.compile.code,
        timedOut: data.compile.signal === 'SIGKILL',
        durationMs,
        memoryExceeded: false,
        compileError: data.compile.stderr || data.compile.output,
      };
    }

    return {
      stdout: data.run.stdout,
      stderr: data.run.stderr,
      exitCode: data.run.code,
      // Piston kills a process that exceeds run_timeout with SIGKILL; a
      // process the candidate's own code kills would typically exit with a
      // normal code instead. Heuristic, like the Docker provider's — Piston
      // doesn't expose a dedicated "timed out" field.
      timedOut: data.run.signal === 'SIGKILL',
      durationMs,
      // Piston doesn't distinguish an OOM kill from any other kill signal in
      // its response, so this provider can't report it — Docker's provider
      // can (see its own memoryExceeded heuristic) precisely because it
      // controls the container's memory limit and exit code directly.
      memoryExceeded: false,
    };
  }
}
