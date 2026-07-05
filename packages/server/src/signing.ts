import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Deterministic JSON serialization (object keys sorted recursively) so the
 * same logical payload always hashes to the same signature regardless of
 * property insertion order — insertion order differs across JS engines/
 * JSON.parse and must not change whether a signature verifies.
 */
export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const entries = keys.map(
      (key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`,
    );
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Signs an arbitrary JSON-serializable value with HMAC-SHA256. Used to prove
 * a score/evaluation was computed server-side and hasn't been altered since
 * — the client can carry the signed value around (e.g. to assemble a final
 * report) without being able to forge or edit it undetected.
 */
export function sign(payload: unknown, secret: string): string {
  return createHmac('sha256', secret).update(canonicalize(payload)).digest('hex');
}

/** Constant-time signature check — never compare signatures with `===`. */
export function verify(payload: unknown, signature: string, secret: string): boolean {
  const expected = sign(payload, secret);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
