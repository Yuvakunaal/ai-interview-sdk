import { describe, expect, it, vi } from 'vitest';
import {
  ProviderAuthError,
  ProviderInvalidRequestError,
  ProviderRateLimitError,
} from '../errors.js';
import { withRetry } from './retry.js';

const noopSleep = async () => {};

describe('withRetry', () => {
  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn(async () => 'ok');
    const result = await withRetry(fn, { sleep: noopSleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a retryable error and eventually succeeds', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new ProviderRateLimitError('rate limited', 'fake');
      return 'ok';
    });

    const result = await withRetry(fn, { sleep: noopSleep, maxAttempts: 5 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws immediately on a non-retryable error (bad request)', async () => {
    const fn = vi.fn(async () => {
      throw new ProviderInvalidRequestError('bad request', 'fake');
    });

    await expect(withRetry(fn, { sleep: noopSleep })).rejects.toThrow(ProviderInvalidRequestError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws immediately on a non-retryable error (auth failure)', async () => {
    const fn = vi.fn(async () => {
      throw new ProviderAuthError('invalid key', 'fake');
    });

    await expect(withRetry(fn, { sleep: noopSleep })).rejects.toThrow(ProviderAuthError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws a real Error, not undefined, when maxAttempts is 0', async () => {
    const fn = vi.fn(async () => 'never called');

    await expect(withRetry(fn, { sleep: noopSleep, maxAttempts: 0 })).rejects.toThrow(Error);
    expect(fn).not.toHaveBeenCalled();
  });

  it('gives up after maxAttempts and throws the last error', async () => {
    const fn = vi.fn(async () => {
      throw new ProviderRateLimitError('rate limited', 'fake');
    });

    await expect(withRetry(fn, { sleep: noopSleep, maxAttempts: 3 })).rejects.toThrow(
      ProviderRateLimitError,
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses the exponential backoff delay when the error has no retryAfterMs', async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 2) throw new ProviderRateLimitError('rate limited', 'fake');
      return 'ok';
    });

    await withRetry(fn, { sleep, baseDelayMs: 100 });
    expect(sleep).toHaveBeenCalledWith(100);
  });

  it('honors retryAfterMs from the provider when present', async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 2) throw new ProviderRateLimitError('rate limited', 'fake', 5000);
      return 'ok';
    });

    await withRetry(fn, { sleep, baseDelayMs: 100 });
    expect(sleep).toHaveBeenCalledWith(5000);
  });

  it('respects a custom isRetryable predicate', async () => {
    const fn = vi.fn(async () => {
      throw new ProviderInvalidRequestError('unusual case', 'fake');
    });

    await expect(
      withRetry(fn, { sleep: noopSleep, maxAttempts: 2, isRetryable: () => true }),
    ).rejects.toThrow(ProviderInvalidRequestError);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
