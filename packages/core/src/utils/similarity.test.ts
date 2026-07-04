import { describe, expect, it } from 'vitest';
import { jaccardSimilarity } from './similarity.js';

describe('jaccardSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(jaccardSimilarity('what is a hash map', 'what is a hash map')).toBe(1);
  });

  it('returns 1 for two empty strings', () => {
    expect(jaccardSimilarity('', '')).toBe(1);
  });

  it('is case- and punctuation-insensitive', () => {
    expect(jaccardSimilarity('What is a Hash Map?', 'what is a hash map')).toBe(1);
  });

  it('returns 0 for completely disjoint strings', () => {
    expect(jaccardSimilarity('hash map lookup', 'binary search tree')).toBe(0);
  });

  it('returns a value strictly between 0 and 1 for partially overlapping strings', () => {
    const score = jaccardSimilarity(
      'how would you scale this to a distributed system',
      'how would you scale this for high availability',
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});
