import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Signs a raw JSON body for webhook delivery, Stripe/GitHub-style: a header
 * value carrying both a timestamp and an HMAC-SHA256 signature over
 * `${timestamp}.${body}`. Binding the timestamp into the signature lets
 * `verifyWebhookSignature` reject stale/replayed deliveries, not just
 * tampered ones.
 */
export function signWebhookPayload(
  rawBody: string,
  secret: string,
  timestamp = Date.now(),
): string {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

function parseSignatureHeader(
  header: string,
): { timestamp: number; signature: string } | undefined {
  const parts = new Map(
    header
      .split(',')
      .map((part) => part.split('='))
      .filter((pair): pair is [string, string] => pair.length === 2)
      .map(([key, value]) => [key.trim(), value.trim()]),
  );
  const timestampRaw = parts.get('t');
  const signature = parts.get('v1');
  if (!timestampRaw || !signature) return undefined;
  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp)) return undefined;
  return { timestamp, signature };
}

/**
 * Verifies a webhook delivery's signature header, for use in the developer's
 * own webhook receiver endpoint (this SDK never receives its own webhooks —
 * it only sends them, per the Zero-Infra Guarantee). Rejects payloads whose
 * timestamp is older than `toleranceMs` (default 5 minutes) even with a
 * valid signature, to bound replay-attack exposure — this is the
 * "delayed-delivery handling" the spec calls for.
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string,
  secret: string,
  toleranceMs = DEFAULT_TOLERANCE_MS,
): boolean {
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;
  if (Math.abs(Date.now() - parsed.timestamp) > toleranceMs) return false;

  const expected = createHmac('sha256', secret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(parsed.signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export interface WebhookDispatcherConfig {
  url: string;
  secret: string;
  /** Override fetch (e.g. for testing, or to point at a queue instead of a direct HTTP call). */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  baseDelayMs?: number;
  /** Called after every failed attempt, including the last. */
  onDeliveryFailure?: (error: unknown, attempt: number) => void;
}

export interface WebhookDeliveryResult {
  delivered: boolean;
  attempts: number;
  idempotencyKey: string;
}

/**
 * Best-effort, in-process retry with exponential backoff for webhook
 * delivery. This is NOT a durable queue — per the Zero-Infra Guarantee this
 * package holds no database of its own, so a process restart mid-retry
 * loses any attempts still pending. If you need delivery to survive a
 * restart, call `send()` from your own durable job queue instead of relying
 * on this dispatcher's in-memory retry loop.
 */
export class WebhookDispatcher {
  private readonly url: string;
  private readonly secret: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly onDeliveryFailure: ((error: unknown, attempt: number) => void) | undefined;

  constructor(config: WebhookDispatcherConfig) {
    this.url = config.url;
    this.secret = config.secret;
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis);
    this.sleep = config.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.maxAttempts = config.maxAttempts ?? 5;
    this.baseDelayMs = config.baseDelayMs ?? 500;
    this.onDeliveryFailure = config.onDeliveryFailure;
  }

  async send(
    event: string,
    payload: unknown,
    idempotencyKey: string = randomUUID(),
  ): Promise<WebhookDeliveryResult> {
    const rawBody = JSON.stringify({ event, payload, idempotencyKey });
    const signatureHeader = signWebhookPayload(rawBody, this.secret);

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const response = await this.fetchImpl(this.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Interview-Sdk-Signature': signatureHeader,
            'Interview-Sdk-Idempotency-Key': idempotencyKey,
          },
          body: rawBody,
        });
        if (response.ok) {
          return { delivered: true, attempts: attempt, idempotencyKey };
        }
        lastError = new Error(`Webhook endpoint responded with ${response.status}`);
      } catch (error) {
        lastError = error;
      }

      this.onDeliveryFailure?.(lastError, attempt);
      if (attempt < this.maxAttempts) {
        await this.sleep(Math.min(30_000, this.baseDelayMs * 2 ** (attempt - 1)));
      }
    }

    return { delivered: false, attempts: this.maxAttempts, idempotencyKey };
  }
}
