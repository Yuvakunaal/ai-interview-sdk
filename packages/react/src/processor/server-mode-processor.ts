import type { InterviewProcessor, ProcessAnswerInput, ProcessAnswerResult } from './types.js';

export class ServerModeRequestError extends Error {}

export interface ServerModeProcessorConfig {
  /**
   * URL to POST each answer to. The developer's `@interview-sdk/server`
   * route handles evaluation and follow-up generation server-side, so AI
   * keys and score integrity never reach the browser. Defaults to
   * `/api/interview/answer`.
   */
  endpoint?: string;
  /** Override fetch (e.g. for testing). */
  fetchImpl?: typeof fetch;
  /** Extra headers to send with every request (e.g. a session/auth token). */
  headers?: Record<string, string>;
}

/**
 * Server Mode: each answer is sent in a single request to the developer's
 * own backend, which evaluates it (using the same @interview-sdk/core
 * engines, server-side) and returns the result. This is the wire contract
 * @interview-sdk/server (Phase 5) implements — see that package's docs for
 * the authoritative shape once it exists.
 */
export class ServerModeProcessor implements InterviewProcessor {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;

  constructor(config: ServerModeProcessorConfig = {}) {
    this.endpoint = config.endpoint ?? '/api/interview/answer';
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
    this.headers = config.headers ?? {};
  }

  async processAnswer(input: ProcessAnswerInput): Promise<ProcessAnswerResult> {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      throw new ServerModeRequestError(
        `Interview server responded with ${response.status} ${response.statusText}` +
          (bodyText ? `: ${bodyText}` : ''),
      );
    }

    const data = (await response.json()) as Partial<ProcessAnswerResult> | null;
    if (!data || typeof data !== 'object' || !data.evaluation) {
      throw new ServerModeRequestError('Interview server response did not include an evaluation.');
    }

    return data as ProcessAnswerResult;
  }
}
