import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CODING_PACKAGE_NAME, CODING_PACKAGE_VERSION } from './index.js';

describe('@interview-sdk/coding scaffold', () => {
  it('exposes the real installed version from package.json, not a hardcoded constant', () => {
    expect(CODING_PACKAGE_NAME).toBe('@interview-sdk/coding');
    const ownPackageVersion = (
      JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
    ).version;
    expect(CODING_PACKAGE_VERSION).toBe(ownPackageVersion);
    expect(CODING_PACKAGE_VERSION).not.toBe('0.0.0');
  });
});
