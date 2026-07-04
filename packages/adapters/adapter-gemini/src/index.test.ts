import { ApiError, type GoogleGenAI } from '@google/genai';
import {
  ProviderAuthError,
  ProviderContextLengthExceededError,
  ProviderInvalidRequestError,
  ProviderOverloadedError,
  ProviderRateLimitError,
  type CompletionRequest,
} from '@interview-sdk/core';
import { describe, expect, it, vi } from 'vitest';
import { createGeminiAdapter, GeminiAdapter } from './index.js';

function fakeClient(generateContent: (params: unknown) => Promise<unknown>): GoogleGenAI {
  return { models: { generateContent } } as unknown as GoogleGenAI;
}

const request: CompletionRequest = {
  messages: [
    { role: 'system', content: 'You are a helpful interviewer.' },
    { role: 'user', content: 'It uses buckets.' },
  ],
  responseFormat: 'json',
};

describe('GeminiAdapter', () => {
  it('has id "gemini"', () => {
    const adapter = new GeminiAdapter({ client: fakeClient(async (_p: unknown) => ({})) });
    expect(adapter.id).toBe('gemini');
  });

  it('moves system messages into config.systemInstruction and maps user/assistant to user/model contents', async () => {
    const generateContent = vi.fn(async (_p: unknown) => ({ text: '{}' }));
    const adapter = new GeminiAdapter({ client: fakeClient(generateContent) });

    await adapter.complete({
      messages: [
        { role: 'system', content: 'You are a helpful interviewer.' },
        { role: 'user', content: 'A hash map.' },
        { role: 'assistant', content: 'Can you elaborate?' },
        { role: 'user', content: 'It uses buckets.' },
      ],
    });

    const params = generateContent.mock.calls[0]![0] as {
      contents: Array<{ role: string; parts: Array<{ text: string }> }>;
      config: { systemInstruction?: string };
    };
    expect(params.config.systemInstruction).toBe('You are a helpful interviewer.');
    expect(params.contents).toEqual([
      { role: 'user', parts: [{ text: 'A hash map.' }] },
      { role: 'model', parts: [{ text: 'Can you elaborate?' }] },
      { role: 'user', parts: [{ text: 'It uses buckets.' }] },
    ]);
  });

  it('requests JSON mime type when responseFormat is json', async () => {
    const generateContent = vi.fn(async (_p: unknown) => ({ text: '{}' }));
    const adapter = new GeminiAdapter({ client: fakeClient(generateContent) });

    await adapter.complete(request);

    const params = generateContent.mock.calls[0]![0] as { config: { responseMimeType?: string } };
    expect(params.config.responseMimeType).toBe('application/json');
  });

  it('omits responseMimeType when responseFormat is not json', async () => {
    const generateContent = vi.fn(async (_p: unknown) => ({ text: 'plain answer' }));
    const adapter = new GeminiAdapter({ client: fakeClient(generateContent) });

    await adapter.complete({ messages: request.messages, responseFormat: 'text' });

    const params = generateContent.mock.calls[0]![0] as { config: { responseMimeType?: string } };
    expect(params.config.responseMimeType).toBeUndefined();
  });

  it('defaults to the gemini-3.5-flash model', async () => {
    const generateContent = vi.fn(async (_p: unknown) => ({ text: '{}' }));
    const adapter = new GeminiAdapter({ client: fakeClient(generateContent) });

    await adapter.complete(request);

    expect((generateContent.mock.calls[0]![0] as { model: string }).model).toBe('gemini-3.5-flash');
  });

  it('allows overriding the model', async () => {
    const generateContent = vi.fn(async (_p: unknown) => ({ text: '{}' }));
    const adapter = new GeminiAdapter({
      client: fakeClient(generateContent),
      model: 'gemini-3.1-pro',
    });

    await adapter.complete(request);

    expect((generateContent.mock.calls[0]![0] as { model: string }).model).toBe('gemini-3.1-pro');
  });

  it('returns response.text as the completion text', async () => {
    const generateContent = vi.fn(async (_p: unknown) => ({
      text: '{"dimensionScores":{"technical":80}}',
    }));
    const adapter = new GeminiAdapter({ client: fakeClient(generateContent) });

    const result = await adapter.complete(request);

    expect(result.text).toBe('{"dimensionScores":{"technical":80}}');
  });

  it('throws ProviderInvalidRequestError when response.text is empty', async () => {
    const generateContent = vi.fn(async (_p: unknown) => ({ text: '' }));
    const adapter = new GeminiAdapter({ client: fakeClient(generateContent) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderInvalidRequestError);
  });

  it('normalizes a 401 as an auth error', async () => {
    const generateContent = vi.fn(async (_p: unknown) => {
      throw new ApiError({ message: 'invalid key', status: 401 });
    });
    const adapter = new GeminiAdapter({ client: fakeClient(generateContent) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderAuthError);
  });

  it('normalizes a 403 as an auth error', async () => {
    const generateContent = vi.fn(async (_p: unknown) => {
      throw new ApiError({ message: 'forbidden', status: 403 });
    });
    const adapter = new GeminiAdapter({ client: fakeClient(generateContent) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderAuthError);
  });

  it('normalizes a 429 as a rate-limit error', async () => {
    const generateContent = vi.fn(async (_p: unknown) => {
      throw new ApiError({ message: 'rate limited', status: 429 });
    });
    const adapter = new GeminiAdapter({ client: fakeClient(generateContent) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderRateLimitError);
  });

  it('normalizes a 5xx as an overloaded error', async () => {
    const generateContent = vi.fn(async (_p: unknown) => {
      throw new ApiError({ message: 'server error', status: 503 });
    });
    const adapter = new GeminiAdapter({ client: fakeClient(generateContent) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderOverloadedError);
  });

  it('normalizes a context-length message as a context-length error', async () => {
    const generateContent = vi.fn(async (_p: unknown) => {
      throw new ApiError({
        message: 'The input token count exceeds the maximum number of tokens allowed',
        status: 400,
      });
    });
    const adapter = new GeminiAdapter({ client: fakeClient(generateContent) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderContextLengthExceededError);
  });

  it('normalizes a plain 400 as an invalid-request error', async () => {
    const generateContent = vi.fn(async (_p: unknown) => {
      throw new ApiError({ message: 'invalid parameter', status: 400 });
    });
    const adapter = new GeminiAdapter({ client: fakeClient(generateContent) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderInvalidRequestError);
  });

  it('normalizes a 404 (e.g. a deprecated model id) as an invalid-request error', async () => {
    const generateContent = vi.fn(async (_p: unknown) => {
      throw new ApiError({ message: 'model not found', status: 404 });
    });
    const adapter = new GeminiAdapter({ client: fakeClient(generateContent) });

    await expect(adapter.complete(request)).rejects.toThrow(ProviderInvalidRequestError);
  });

  it('passes through a non-Gemini error unchanged', async () => {
    const generateContent = vi.fn(async (_p: unknown) => {
      throw new Error('something else entirely');
    });
    const adapter = new GeminiAdapter({ client: fakeClient(generateContent) });

    await expect(adapter.complete(request)).rejects.toThrow('something else entirely');
  });
});

describe('createGeminiAdapter', () => {
  it('constructs a GeminiAdapter instance', () => {
    const adapter = createGeminiAdapter({ client: fakeClient(async (_p: unknown) => ({})) });
    expect(adapter).toBeInstanceOf(GeminiAdapter);
    expect(adapter.id).toBe('gemini');
  });
});
