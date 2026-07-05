import { ProviderError } from '@interview-sdk/core';
import type { ProcessAnswerRequestBody, ServerAnswerProcessor } from './answer-processor.js';
import { UnknownQuestionIdError } from './errors.js';

export interface CreateInterviewAnswerHandlerConfig {
  /** Called for any error while processing a request, before the error response is sent — wire into your own logging/observability. Never called for expected 4xx cases the handler already reports (invalid JSON, missing questionId). */
  onError?: (error: unknown) => void;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isProcessAnswerRequestBody(value: unknown): value is ProcessAnswerRequestBody {
  if (!value || typeof value !== 'object') return false;
  const answer = (value as { answer?: unknown }).answer;
  return (
    !!answer &&
    typeof answer === 'object' &&
    typeof (answer as { questionId?: unknown }).questionId === 'string'
  );
}

/**
 * Builds a standard Fetch API `(Request) => Promise<Response>` handler
 * implementing the wire contract @interview-sdk/react's `ServerModeProcessor`
 * expects: POST a JSON body shaped like `ProcessAnswerRequestBody`, get back
 * `{ evaluation, followUp? }`. Works as-is in any router that speaks
 * Fetch API Request/Response (Next.js Route Handlers, Deno, Bun, Cloudflare
 * Workers, Hono); for Node's classic `(req, res)` style (plain http, Express),
 * wrap it — see this package's README for a short adapter snippet.
 */
export function createInterviewAnswerHandler(
  processor: ServerAnswerProcessor,
  config: CreateInterviewAnswerHandlerConfig = {},
) {
  return async function handleInterviewAnswer(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
    }

    if (!isProcessAnswerRequestBody(body)) {
      return jsonResponse({ error: 'Request body must include answer.questionId (string).' }, 400);
    }

    try {
      const result = await processor.processAnswer(body);
      return jsonResponse(result, 200);
    } catch (error) {
      config.onError?.(error);
      if (error instanceof UnknownQuestionIdError) {
        return jsonResponse({ error: error.message }, 400);
      }
      if (error instanceof ProviderError) {
        return jsonResponse({ error: 'The AI provider request failed.' }, 502);
      }
      return jsonResponse({ error: 'Internal error while processing the answer.' }, 500);
    }
  };
}
