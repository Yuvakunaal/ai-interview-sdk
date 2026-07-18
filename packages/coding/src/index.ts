import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

export const CODING_PACKAGE_NAME = '@interview-sdk/coding';

/**
 * The real installed version, read from this package's own package.json —
 * not a hardcoded constant (which previously read '0.0.0' forever,
 * regardless of the actual published version). Resolved via the package's
 * own "./package.json" export, so it works identically in-repo and as a
 * real published install.
 */
export const CODING_PACKAGE_VERSION: string = (() => {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve('@interview-sdk/coding/package.json');
  return (JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string }).version;
})();

export * from './errors.js';
export * from './types.js';
export * from './complexity-heuristics.js';
export * from './coding-evaluation-engine.js';

export * from './providers/docker-provider.js';
export * from './providers/piston-provider.js';
