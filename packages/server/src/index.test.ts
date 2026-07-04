import { describe, expect, it } from 'vitest';
import { SERVER_PACKAGE_NAME, SERVER_PACKAGE_VERSION } from './index.js';

describe('@interview-sdk/server scaffold', () => {
  it('exposes package identity constants', () => {
    expect(SERVER_PACKAGE_NAME).toBe('@interview-sdk/server');
    expect(SERVER_PACKAGE_VERSION).toBe('0.0.0');
  });
});
