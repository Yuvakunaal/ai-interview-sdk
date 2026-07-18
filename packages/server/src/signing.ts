import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Deterministic JSON serialization (object keys sorted recursively) so the
 * same logical payload always hashes to the same signature regardless of
 * property insertion order — insertion order differs across JS engines/
 * JSON.parse and must not change whether a signature verifies.
 *
 * Keys whose value is `undefined` are skipped entirely, matching
 * `JSON.stringify`'s own behavior (it silently drops them). This matters
 * because every real signed payload here is an `EvaluationResult`, whose
 * optional fields (`rationale`, `matchesAnswerKey`, `conceptCoverage[].partial`)
 * are built via object-literal assignment (e.g. `rationale: parsed.rationale`)
 * — present as an explicit key even when the source value is `undefined`,
 * rather than the key being absent. A payload signed in that in-memory shape
 * can never re-verify once it's gone out over HTTP as JSON and come back
 * (as every real caller does — sign server-side, ship to the browser,
 * re-verify server-side later): JSON has no `undefined`, so the same key is
 * simply gone on the other side, producing a different canonical string and
 * a false "tampered" rejection for a completely untouched evaluation.
 * Verified against a real AI provider response missing these fields, not
 * just a synthetic payload.
 */
export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`);
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
