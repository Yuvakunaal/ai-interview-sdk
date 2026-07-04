import { describe, expect, it } from 'vitest';
import { CLI_PACKAGE_NAME, CLI_PACKAGE_VERSION } from './index.js';

describe('@interview-sdk/cli scaffold', () => {
  it('exposes package identity constants', () => {
    expect(CLI_PACKAGE_NAME).toBe('@interview-sdk/cli');
    expect(CLI_PACKAGE_VERSION).toBe('0.0.0');
  });
});
