import { describe, expect, it, vi } from 'vitest';
import {
  ConfigValidationError,
  ProviderInvalidRequestError,
  ProviderRateLimitError,
} from '../errors.js';
import { FailoverAdapter } from './failover.js';
import type { AIProviderAdapter, CompletionRequest } from './types.js';

const request: CompletionRequest = { messages: [{ role: 'user', content: 'hi' }] };

function fakeAdapter(id: string, impl: () => Promise<{ text: string }>): AIProviderAdapter {
  return { id, complete: vi.fn(impl) };
}

describe('FailoverAdapter', () => {
  it('throws on construction with no adapters', () => {
    expect(() => new FailoverAdapter({ adapters: [] })).toThrow(ConfigValidationError);
  });

  it('uses the first adapter when it succeeds', async () => {
    const first = fakeAdapter('a', async () => ({ text: 'from a' }));
    const second = fakeAdapter('b', async () => ({ text: 'from b' }));
    const failover = new FailoverAdapter({ adapters: [first, second] });

    const result = await failover.complete(request);

    expect(result.text).toBe('from a');
    expect(second.complete).not.toHaveBeenCalled();
  });

  it('falls over to the next adapter on a rate limit error', async () => {
    const first = fakeAdapter('a', async () => {
      throw new ProviderRateLimitError('rate limited', 'a');
    });
    const second = fakeAdapter('b', async () => ({ text: 'from b' }));
    const failover = new FailoverAdapter({ adapters: [first, second] });

    const result = await failover.complete(request);

    expect(result.text).toBe('from b');
  });

  it('falls over across more than two adapters', async () => {
    const first = fakeAdapter('a', async () => {
      throw new ProviderRateLimitError('rate limited', 'a');
    });
    const second = fakeAdapter('b', async () => {
      throw new ProviderInvalidRequestError('deprecated model', 'b');
    });
    const third = fakeAdapter('c', async () => ({ text: 'from c' }));
    const failover = new FailoverAdapter({ adapters: [first, second, third] });

    const result = await failover.complete(request);

    expect(result.text).toBe('from c');
  });

  it('throws the last error once every adapter has failed', async () => {
    const first = fakeAdapter('a', async () => {
      throw new ProviderRateLimitError('rate limited', 'a');
    });
    const second = fakeAdapter('b', async () => {
      throw new ProviderRateLimitError('rate limited again', 'b');
    });
    const failover = new FailoverAdapter({ adapters: [first, second] });

    await expect(failover.complete(request)).rejects.toThrow('rate limited again');
  });

  it('does not fail over on a non-eligible error by default', async () => {
    const first = fakeAdapter('a', async () => {
      throw new Error('some unrelated bug');
    });
    const second = fakeAdapter('b', async () => ({ text: 'from b' }));
    const failover = new FailoverAdapter({ adapters: [first, second] });

    await expect(failover.complete(request)).rejects.toThrow('some unrelated bug');
    expect(second.complete).not.toHaveBeenCalled();
  });

  it('respects a custom isFailoverEligible predicate', async () => {
    const first = fakeAdapter('a', async () => {
      throw new Error('custom-eligible error');
    });
    const second = fakeAdapter('b', async () => ({ text: 'from b' }));
    const failover = new FailoverAdapter({
      adapters: [first, second],
      isFailoverEligible: (error) =>
        error instanceof Error && error.message === 'custom-eligible error',
    });

    const result = await failover.complete(request);
    expect(result.text).toBe('from b');
  });

  it('derives its id from the wrapped adapter ids', () => {
    const failover = new FailoverAdapter({
      adapters: [
        fakeAdapter('openai', async () => ({ text: '' })),
        fakeAdapter('claude', async () => ({ text: '' })),
      ],
    });
    expect(failover.id).toBe('failover(openai,claude)');
  });
});
