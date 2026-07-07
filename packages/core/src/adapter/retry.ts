import {
  ProviderConnectionError,
  ProviderOverloadedError,
  ProviderRateLimitError,
  ProviderTimeoutError,
} from '../errors.js';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 8000;

function defaultIsRetryable(error: unknown): boolean {
  return (
    error instanceof ProviderRateLimitError ||
    error instanceof ProviderOverloadedError ||
    error instanceof ProviderConnectionError ||
    error instanceof ProviderTimeoutError
  );
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a provider call with exponential backoff. Only retries errors from
 * the shared ProviderError taxonomy that represent transient conditions
 * (rate limit, overloaded, connection, timeout) by default — a 4xx like
 * ProviderInvalidRequestError or ProviderAuthError will not be retried since
 * repeating the same bad request cannot succeed.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const isRetryable = options.isRetryable ?? defaultIsRetryable;
  const sleep = options.sleep ?? defaultSleep;

  if (maxAttempts <= 0) {
    throw new Error('withRetry: maxAttempts must be at least 1.');
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxAttempts - 1;
      if (isLastAttempt || !isRetryable(error)) {
        throw error;
      }
      const retryAfterMs = error instanceof ProviderRateLimitError ? error.retryAfterMs : undefined;
      const backoffMs = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      await sleep(retryAfterMs ?? backoffMs);
    }
  }
  throw lastError;
}
