import { describe, expect, it } from 'vitest';
import { CORE_PACKAGE_NAME, CORE_PACKAGE_VERSION } from './index.js';

describe('@interview-sdk/core scaffold', () => {
  it('exposes package identity constants', () => {
    expect(CORE_PACKAGE_NAME).toBe('@interview-sdk/core');
    expect(CORE_PACKAGE_VERSION).toBe('0.0.0');
  });
});
