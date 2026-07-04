import { describe, expect, it } from 'vitest';
import { ADAPTER_CLAUDE_PACKAGE_NAME, ADAPTER_CLAUDE_PACKAGE_VERSION } from './index.js';

describe('@interview-sdk/adapter-claude scaffold', () => {
  it('exposes package identity constants', () => {
    expect(ADAPTER_CLAUDE_PACKAGE_NAME).toBe('@interview-sdk/adapter-claude');
    expect(ADAPTER_CLAUDE_PACKAGE_VERSION).toBe('0.0.0');
  });
});
