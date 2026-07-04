import { describe, expect, it } from 'vitest';
import { CODING_PACKAGE_NAME, CODING_PACKAGE_VERSION } from './index.js';

describe('@interview-sdk/coding scaffold', () => {
  it('exposes package identity constants', () => {
    expect(CODING_PACKAGE_NAME).toBe('@interview-sdk/coding');
    expect(CODING_PACKAGE_VERSION).toBe('0.0.0');
  });
});
