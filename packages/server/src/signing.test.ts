import { describe, expect, it } from 'vitest';
import { canonicalize, sign, verify } from './signing.js';

describe('canonicalize', () => {
  it('produces identical output regardless of key insertion order', () => {
    const a = { b: 2, a: 1, nested: { y: 2, x: 1 } };
    const b = { a: 1, nested: { x: 1, y: 2 }, b: 2 };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('preserves array order', () => {
    expect(canonicalize([1, 2, 3])).not.toBe(canonicalize([3, 2, 1]));
  });
});

describe('sign / verify', () => {
  const payload = { questionId: 'q1', totalScore: 88 };

  it('verifies a signature produced for the same payload and secret', () => {
    const signature = sign(payload, 'secret');
    expect(verify(payload, signature, 'secret')).toBe(true);
  });

  it('rejects a signature checked against a different payload', () => {
    const signature = sign(payload, 'secret');
    expect(verify({ ...payload, totalScore: 100 }, signature, 'secret')).toBe(false);
  });

  it('rejects a signature checked against a different secret', () => {
    const signature = sign(payload, 'secret');
    expect(verify(payload, signature, 'wrong-secret')).toBe(false);
  });

  it('is insensitive to key insertion order in the payload being verified', () => {
    const signature = sign({ a: 1, b: 2 }, 'secret');
    expect(verify({ b: 2, a: 1 }, signature, 'secret')).toBe(true);
  });

  it('rejects a garbage (non-hex, wrong-length) signature without throwing', () => {
    expect(verify(payload, 'not-a-real-signature', 'secret')).toBe(false);
  });
});
