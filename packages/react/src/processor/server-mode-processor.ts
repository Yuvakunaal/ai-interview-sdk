import type { InterviewProcessor, ProcessAnswerInput, ProcessAnswerResult } from './types.js';

export class ServerModeRequestError extends Error {}

const MAX_ERROR_BODY_LENGTH = 500;

/**
 * A non-2xx response body is either the developer's own handler returning
 * a clean `{ error: string }` (the expected case — extract just that
 * message), or something else entirely reaching the browser unfiltered —
 * most commonly a framework's own HTML dev-error page when the route
 * handler itself crashed (e.g. Next.js's error overlay), but also possibly
 * a reverse proxy's error page or a raw stack trace. An HTML body is never
 * meant to be read as text, so it's replaced outright rather than merely
 * truncated; anything else unexpected is at least capped to a bounded,
 * safe length instead of dumped verbatim into a candidate-facing UI.
 */
function describeErrorBody(bodyText: string, contentType: string | null): string {
  try {
    const parsed = JSON.parse(bodyText) as { error?: unknown };
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    // Not JSON — fall through below.
  }
  if (contentType?.includes('text/html') || bodyText.trimStart().startsWith('<!DOCTYPE')) {
    return 'The server returned an unexpected error page instead of a JSON response — check your server logs for details.';
  }
  return bodyText.length > MAX_ERROR_BODY_LENGTH
    ? `${bodyText.slice(0, MAX_ERROR_BODY_LENGTH)}…`
    : bodyText;
}

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
      const detail = bodyText ? describeErrorBody(bodyText, response.headers.get('Content-Type')) : '';
      throw new ServerModeRequestError(
        `Interview server responded with ${response.status} ${response.statusText}` +
          (detail ? `: ${detail}` : ''),
      );
    }

    const data = (await response.json()) as Partial<ProcessAnswerResult> | null;
    if (!data || typeof data !== 'object' || !data.evaluation) {
      throw new ServerModeRequestError('Interview server response did not include an evaluation.');
    }

    return data as ProcessAnswerResult;
  }
}
