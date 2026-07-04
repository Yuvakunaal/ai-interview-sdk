import { describe, expect, it } from 'vitest';
import { ADAPTER_OPENAI_PACKAGE_NAME, ADAPTER_OPENAI_PACKAGE_VERSION } from './index.js';

describe('@interview-sdk/adapter-openai scaffold', () => {
  it('exposes package identity constants', () => {
    expect(ADAPTER_OPENAI_PACKAGE_NAME).toBe('@interview-sdk/adapter-openai');
    expect(ADAPTER_OPENAI_PACKAGE_VERSION).toBe('0.0.0');
  });
});
