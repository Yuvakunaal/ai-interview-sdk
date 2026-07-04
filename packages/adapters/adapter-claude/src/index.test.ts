import Anthropic from '@anthropic-ai/sdk';
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
import { ClaudeAdapter, createClaudeAdapter } from './index.js';

function fakeClient(create: (params: unknown) => Promise<unknown>): Anthropic {
  return { messages: { create } } as unknown as Anthropic;
}

const request: CompletionRequest = {
  messages: [
    { role: 'system', content: 'You are a helpful interviewer.' },
    { role: 'user', content: 'It uses buckets.' },
  ],
  responseFormat: 'json',
};

describe('ClaudeAdapter', () => {
  it('has id "claude"', () => {
    const adapter = new ClaudeAdapter({ client: fakeClient(async () => ({})) });
    expect(adapter.id).toBe('claude');
  });

  it('splits system messages from the conversation and forwards them separately', async () => {
    const create = vi.fn(async (_params: unknown) => ({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{}' }],
    }));
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await adapter.complete(request);

    const params = create.mock.calls[0]![0] as { system?: string; messages: unknown[] };
    expect(params.system).toBe('You are a helpful interviewer.');
    expect(params.messages).toEqual([{ role: 'user', content: 'It uses buckets.' }]);
  });

  it('defaults to the claude-opus-4-8 model', async () => {
    const create = vi.fn(async (_params: unknown) => ({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{}' }],
    }));
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await adapter.complete(request);

    expect((create.mock.calls[0]![0] as { model: string }).model).toBe('claude-opus-4-8');
  });

  it('allows overriding the model', async () => {
    const create = vi.fn(async (_params: unknown) => ({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{}' }],
    }));
    const adapter = new ClaudeAdapter({ client: fakeClient(create), model: 'claude-sonnet-5' });

    await adapter.complete(request);

    expect((create.mock.calls[0]![0] as { model: string }).model).toBe('claude-sonnet-5');
  });

  it('extracts the text content block from the response', async () => {
    const create = vi.fn(async (_params: unknown) => ({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"dimensionScores":{"technical":80}}' }],
    }));
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    const result = await adapter.complete(request);

    expect(result.text).toBe('{"dimensionScores":{"technical":80}}');
  });

  it('throws ProviderInvalidRequestError when Claude issues a safety refusal', async () => {
    const create = vi.fn(async (_params: unknown) => ({ stop_reason: 'refusal', content: [] }));
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderInvalidRequestError);
  });

  it('throws ProviderInvalidRequestError when the response has no text block', async () => {
    const create = vi.fn(async (_params: unknown) => ({
      stop_reason: 'end_turn',
      content: [{ type: 'image' }],
    }));
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderInvalidRequestError);
  });

  it('normalizes a rate-limit error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new Anthropic.RateLimitError(
        429,
        { type: 'rate_limit_error' },
        'rate limited',
        new Headers(),
      );
    });
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderRateLimitError);
  });

  it('normalizes an authentication error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new Anthropic.AuthenticationError(
        401,
        { type: 'authentication_error' },
        'invalid key',
        new Headers(),
      );
    });
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderAuthError);
  });

  it('normalizes a permission-denied error as an auth error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new Anthropic.PermissionDeniedError(
        403,
        { type: 'permission_error' },
        'forbidden',
        new Headers(),
      );
    });
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderAuthError);
  });

  it('normalizes a server error as an overloaded error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new Anthropic.InternalServerError(
        500,
        { type: 'api_error' },
        'server error',
        new Headers(),
      );
    });
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderOverloadedError);
  });

  it('normalizes a connection timeout error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new Anthropic.APIConnectionTimeoutError({ message: 'timed out' });
    });
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderTimeoutError);
  });

  it('normalizes a generic connection error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new Anthropic.APIConnectionError({ message: 'network down' });
    });
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderConnectionError);
  });

  it('normalizes a context-length bad-request error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new Anthropic.BadRequestError(
        400,
        {
          type: 'invalid_request_error',
          message: 'prompt is too long: 250000 tokens > 200000 maximum',
        },
        undefined,
        new Headers(),
      );
    });
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderContextLengthExceededError);
  });

  it('normalizes a plain bad-request error as an invalid-request error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new Anthropic.BadRequestError(
        400,
        { type: 'invalid_request_error', message: 'messages must alternate' },
        undefined,
        new Headers(),
      );
    });
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderInvalidRequestError);
  });

  it('normalizes a not-found error (e.g. a deprecated model id) as an invalid-request error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new Anthropic.NotFoundError(
        404,
        { type: 'not_found_error' },
        'model not found',
        new Headers(),
      );
    });
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderInvalidRequestError);
  });

  it('normalizes any other Anthropic APIError (e.g. 409 conflict) as an invalid-request error', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new Anthropic.ConflictError(
        409,
        { type: 'invalid_request_error' },
        'conflict',
        new Headers(),
      );
    });
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderInvalidRequestError);
  });

  it('passes through a non-Anthropic error unchanged', async () => {
    const create = vi.fn(async (_params: unknown) => {
      throw new Error('something else entirely');
    });
    const adapter = new ClaudeAdapter({ client: fakeClient(create) });

    await expect(adapter.complete(request)).rejects.toThrow('something else entirely');
  });
});

describe('createClaudeAdapter', () => {
  it('constructs a ClaudeAdapter instance', () => {
    const adapter = createClaudeAdapter({ client: fakeClient(async () => ({})) });
    expect(adapter).toBeInstanceOf(ClaudeAdapter);
    expect(adapter.id).toBe('claude');
  });
});
