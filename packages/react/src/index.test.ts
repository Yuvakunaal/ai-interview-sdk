import { describe, expect, it } from 'vitest';
import { REACT_PACKAGE_NAME, REACT_PACKAGE_VERSION } from './index.js';

describe('@interview-sdk/react scaffold', () => {
  it('exposes package identity constants', () => {
    expect(REACT_PACKAGE_NAME).toBe('@interview-sdk/react');
    expect(REACT_PACKAGE_VERSION).toBe('0.0.0');
  });
});
