import { describe, expect, it, vi } from 'vitest';
import { WebhookDispatcher, signWebhookPayload, verifyWebhookSignature } from './webhooks.js';

describe('signWebhookPayload / verifyWebhookSignature', () => {
  const body = JSON.stringify({ event: 'sessionEnd', payload: { totalScore: 88 } });

  it('verifies a signature produced for the same body and secret', () => {
    const header = signWebhookPayload(body, 'secret');
    expect(verifyWebhookSignature(body, header, 'secret')).toBe(true);
  });

  it('rejects a signature checked against a tampered body', () => {
    const header = signWebhookPayload(body, 'secret');
    expect(verifyWebhookSignature(body.replace('88', '10'), header, 'secret')).toBe(false);
  });

  it('rejects a signature checked against the wrong secret', () => {
    const header = signWebhookPayload(body, 'secret');
    expect(verifyWebhookSignature(body, header, 'wrong')).toBe(false);
  });

  it('rejects a stale timestamp even with a valid signature', () => {
    const staleTimestamp = Date.now() - 10 * 60 * 1000;
    const header = signWebhookPayload(body, 'secret', staleTimestamp);
    expect(verifyWebhookSignature(body, header, 'secret')).toBe(false);
  });

  it('accepts a timestamp within a custom tolerance', () => {
    const timestamp = Date.now() - 10 * 60 * 1000;
    const header = signWebhookPayload(body, 'secret', timestamp);
    expect(verifyWebhookSignature(body, header, 'secret', 15 * 60 * 1000)).toBe(true);
  });

  it('rejects a malformed signature header', () => {
    expect(verifyWebhookSignature(body, 'garbage', 'secret')).toBe(false);
  });
});

describe('WebhookDispatcher', () => {
  it('delivers on the first attempt when the endpoint responds ok', async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 200 }),
    );
    const dispatcher = new WebhookDispatcher({
      url: 'https://dev.example/webhook',
      secret: 's',
      fetchImpl,
    });

    const result = await dispatcher.send('sessionEnd', { totalScore: 88 }, 'fixed-key');

    expect(result).toEqual({ delivered: true, attempts: 1, idempotencyKey: 'fixed-key' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0]!;
    const headers = init!.headers as Record<string, string>;
    expect(headers['Interview-Sdk-Idempotency-Key']).toBe('fixed-key');
    expect(headers['Interview-Sdk-Signature']).toMatch(/^t=\d+,v1=[0-9a-f]+$/);
  });

  it('retries with backoff and succeeds on a later attempt', async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      return call < 3 ? new Response(null, { status: 503 }) : new Response(null, { status: 200 });
    });
    const sleep = vi.fn(async () => {});
    const dispatcher = new WebhookDispatcher({
      url: 'https://dev.example/webhook',
      secret: 's',
      fetchImpl,
      sleep,
    });

    const result = await dispatcher.send('sessionEnd', {});

    expect(result.delivered).toBe(true);
    expect(result.attempts).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxAttempts and reports non-delivery', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 500 }));
    const sleep = vi.fn(async () => {});
    const onDeliveryFailure = vi.fn();
    const dispatcher = new WebhookDispatcher({
      url: 'https://dev.example/webhook',
      secret: 's',
      fetchImpl,
      sleep,
      maxAttempts: 3,
      onDeliveryFailure,
    });

    const result = await dispatcher.send('sessionEnd', {});

    expect(result.delivered).toBe(false);
    expect(result.attempts).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(onDeliveryFailure).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('treats a network-level rejection the same as a failed response', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const sleep = vi.fn(async () => {});
    const dispatcher = new WebhookDispatcher({
      url: 'https://dev.example/webhook',
      secret: 's',
      fetchImpl,
      sleep,
      maxAttempts: 2,
    });

    const result = await dispatcher.send('sessionEnd', {});
    expect(result.delivered).toBe(false);
    expect(result.attempts).toBe(2);
  });

  it('generates an idempotency key when none is provided', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const dispatcher = new WebhookDispatcher({
      url: 'https://dev.example/webhook',
      secret: 's',
      fetchImpl,
    });

    const result = await dispatcher.send('sessionEnd', {});
    expect(result.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  });
});
