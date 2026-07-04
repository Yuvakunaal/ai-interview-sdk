import { describe, expect, it } from 'vitest';
import { ADAPTER_GEMINI_PACKAGE_NAME, ADAPTER_GEMINI_PACKAGE_VERSION } from './index.js';

describe('@interview-sdk/adapter-gemini scaffold', () => {
  it('exposes package identity constants', () => {
    expect(ADAPTER_GEMINI_PACKAGE_NAME).toBe('@interview-sdk/adapter-gemini');
    expect(ADAPTER_GEMINI_PACKAGE_VERSION).toBe('0.0.0');
  });
});
