import { describe, expect, it } from 'vitest';
import { CLI_PACKAGE_NAME } from './index.js';

describe('@interview-sdk/cli scaffold', () => {
  it('exposes package identity constants', () => {
    expect(CLI_PACKAGE_NAME).toBe('@interview-sdk/cli');
  });
});
