import { AnswerTooLongError, ProviderError, TooManyPreviousTurnsError } from '@interview-sdk/core';
import type { ProcessAnswerRequestBody, ServerAnswerProcessor } from './answer-processor.js';
import { UnknownQuestionIdError } from './errors.js';

export interface CreateInterviewAnswerHandlerConfig {
  /** Called for any error while processing a request, before the error response is sent — wire into your own logging/observability. Never called for expected 4xx cases the handler already reports (invalid JSON, missing questionId). */
  onError?: (error: unknown) => void;
  /** Hard cap on the request body size in bytes, enforced before JSON parsing. Defaults to 256KB — generous for a question/rubric echo plus a long transcript, far below anything a legitimate answer needs. */
  maxBodyBytes?: number;
}

const DEFAULT_MAX_BODY_BYTES = 256 * 1024;

class PayloadTooLargeError extends Error {}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Reads the request body as text while enforcing a hard byte cap, so a
 * multi-megabyte payload never gets fully buffered into memory just to
 * discover afterwards that it's too large. `Content-Length` is checked as a
 * fast path, but it's attacker-controlled (or simply absent under chunked
 * transfer encoding) — the running byte count from the actual stream is
 * the real enforcement.
 */
async function readBodyWithLimit(request: Request, maxBytes: number): Promise<string> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new PayloadTooLargeError();
  }

  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }

  return new TextDecoder().decode(concatChunks(chunks, totalBytes));
}

function concatChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
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
  const maxBodyBytes = config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return async function handleInterviewAnswer(request: Request): Promise<Response> {
    let rawBody: string;
    try {
      rawBody = await readBodyWithLimit(request, maxBodyBytes);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return jsonResponse(
          { error: `Request body exceeds the ${maxBodyBytes}-byte limit.` },
          413,
        );
      }
      throw error;
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
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
      if (error instanceof AnswerTooLongError || error instanceof TooManyPreviousTurnsError) {
        return jsonResponse({ error: error.message }, 413);
      }
      if (error instanceof ProviderError) {
        return jsonResponse({ error: 'The AI provider request failed.' }, 502);
      }
      return jsonResponse({ error: 'Internal error while processing the answer.' }, 500);
    }
  };
}
