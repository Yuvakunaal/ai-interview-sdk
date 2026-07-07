import OpenAI from 'openai';
import {
  ProviderAuthError,
  ProviderConnectionError,
  ProviderContextLengthExceededError,
  ProviderInvalidRequestError,
  ProviderOverloadedError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  type CompletionRequest,
} from '@interview-sdk/core';
import { describe, expect, it, vi } from 'vitest';
import { createOpenAIAdapter, OpenAIAdapter } from './index.js';

function fakeClient(create: (params: unknown) => Promise<unknown>): OpenAI {
  return { responses: { create } } as unknown as OpenAI;
}

const request: CompletionRequest = {
  messages: [
    { role: 'system', content: 'You are a helpful interviewer.' },
    { role: 'user', content: 'It uses buckets.' },
  ],
  responseFormat: 'json',
};

describe('OpenAIAdapter', () => {
  it('has id "openai"', () => {
    const adapter = new OpenAIAdapter({ client: fakeClient(async (_params: unknown) => ({})) });
    expect(adapter.id).toBe('openai');
  });

  it('forwards messages as the Responses API input array', async () => {
    const create = vi.fn(async (_params: unknown) => ({ output_text: '{}' }));
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await adapter.complete(request);

    const params = create.mock.calls[0]![0] as { input: unknown[] };
    expect(params.input).toEqual([
      { role: 'system', content: 'You are a helpful interviewer.' },
      { role: 'user', content: 'It uses buckets.' },
    ]);
  });

  it('requests json_object format when responseFormat is json', async () => {
    const create = vi.fn(async (_params: unknown) => ({ output_text: '{}' }));
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await adapter.complete(request);

    const params = create.mock.calls[0]![0] as { text?: { format: { type: string } } };
    expect(params.text?.format.type).toBe('json_object');
  });

  it('omits the text.format field when responseFormat is not json', async () => {
    const create = vi.fn(async (_params: unknown) => ({ output_text: 'plain answer' }));
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await adapter.complete({ messages: request.messages, responseFormat: 'text' });

    const params = create.mock.calls[0]![0] as { text?: unknown };
    expect(params.text).toBeUndefined();
  });

  it('defaults to the gpt-5.4-mini model', async () => {
    const create = vi.fn(async (_params: unknown) => ({ output_text: '{}' }));
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await adapter.complete(request);

    expect((create.mock.calls[0]![0] as { model: string }).model).toBe('gpt-5.4-mini');
  });

  it('allows overriding the model', async () => {
    const create = vi.fn(async (_params: unknown) => ({ output_text: '{}' }));
    const adapter = new OpenAIAdapter({ client: fakeClient(create), model: 'gpt-5.5' });

    await adapter.complete(request);

    expect((create.mock.calls[0]![0] as { model: string }).model).toBe('gpt-5.5');
  });

  it('returns output_text as the completion text', async () => {
    const create = vi.fn(async (_params: unknown) => ({
      output_text: '{"dimensionScores":{"technical":80}}',
    }));
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    const result = await adapter.complete(request);

    expect(result.text).toBe('{"dimensionScores":{"technical":80}}');
  });

  it('throws ProviderInvalidRequestError when output_text is empty', async () => {
    const create = vi.fn(async (_params: unknown) => ({ output_text: '' }));
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderInvalidRequestError);
  });

  it('normalizes a rate-limit error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new OpenAI.RateLimitError(429, { message: 'rate limited' }, undefined, new Headers());
    });
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderRateLimitError);
  });

  it("carries the provider's real Retry-After header into retryAfterMs, instead of discarding it", async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new OpenAI.RateLimitError(
        429,
        { message: 'rate limited' },
        undefined,
        new Headers({ 'retry-after': '30' }),
      );
    });
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toMatchObject({
      retryAfterMs: 30_000,
    });
  });

  it('normalizes an authentication error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new OpenAI.AuthenticationError(
        401,
        { message: 'invalid key' },
        undefined,
        new Headers(),
      );
    });
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderAuthError);
  });

  it('normalizes a permission-denied error as an auth error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new OpenAI.PermissionDeniedError(
        403,
        { message: 'forbidden' },
        undefined,
        new Headers(),
      );
    });
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderAuthError);
  });

  it('normalizes a server error as an overloaded error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new OpenAI.InternalServerError(
        500,
        { message: 'server error' },
        undefined,
        new Headers(),
      );
    });
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderOverloadedError);
  });

  it('normalizes a connection timeout error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new OpenAI.APIConnectionTimeoutError({ message: 'timed out' });
    });
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderTimeoutError);
  });

  it('normalizes a generic connection error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new OpenAI.APIConnectionError({ message: 'network down' });
    });
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderConnectionError);
  });

  it('normalizes a context-length bad-request error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new OpenAI.BadRequestError(
        400,
        { message: "This model's maximum context length is 128000 tokens" },
        undefined,
        new Headers(),
      );
    });
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderContextLengthExceededError);
  });

  it('normalizes a plain bad-request error as an invalid-request error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new OpenAI.BadRequestError(
        400,
        { message: 'invalid parameter' },
        undefined,
        new Headers(),
      );
    });
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderInvalidRequestError);
  });

  it('normalizes a not-found error (e.g. a deprecated model id) as an invalid-request error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new OpenAI.NotFoundError(404, { message: 'model not found' }, undefined, new Headers());
    });
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderInvalidRequestError);
  });

  it('normalizes any other OpenAI APIError (e.g. 409 conflict) as an invalid-request error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new OpenAI.ConflictError(409, { message: 'conflict' }, undefined, new Headers());
    });
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderInvalidRequestError);
  });

  it('passes through a non-OpenAI error unchanged', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new Error('something else entirely');
    });
    const adapter = new OpenAIAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow('something else entirely');
  });
});

describe('createOpenAIAdapter', () => {
  it('constructs an OpenAIAdapter instance', () => {
    const adapter = createOpenAIAdapter({ client: fakeClient(async (_params: unknown) => ({})) });
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
    expect(adapter.id).toBe('openai');
  });
});
