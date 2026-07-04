import { describe, expect, it } from 'vitest';
import { ADAPTER_DEEPGRAM_PACKAGE_NAME, ADAPTER_DEEPGRAM_PACKAGE_VERSION } from './index.js';

describe('@interview-sdk/adapter-deepgram scaffold', () => {
  it('exposes package identity constants', () => {
    expect(ADAPTER_DEEPGRAM_PACKAGE_NAME).toBe('@interview-sdk/adapter-deepgram');
    expect(ADAPTER_DEEPGRAM_PACKAGE_VERSION).toBe('0.0.0');
  });
});
