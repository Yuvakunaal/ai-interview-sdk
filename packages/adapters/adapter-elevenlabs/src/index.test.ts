import { describe, expect, it } from 'vitest';
import { ADAPTER_ELEVENLABS_PACKAGE_NAME, ADAPTER_ELEVENLABS_PACKAGE_VERSION } from './index.js';

describe('@interview-sdk/adapter-elevenlabs scaffold', () => {
  it('exposes package identity constants', () => {
    expect(ADAPTER_ELEVENLABS_PACKAGE_NAME).toBe('@interview-sdk/adapter-elevenlabs');
    expect(ADAPTER_ELEVENLABS_PACKAGE_VERSION).toBe('0.0.0');
  });
});
