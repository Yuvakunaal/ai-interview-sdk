import { cpSync, existsSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  onSuccess: async () => {
    // `interview-sdk dashboard` serves this static bundle at runtime —
    // built by @interview-sdk/dashboard (turbo builds it first via its
    // devDependency reference), copied here so it ships inside this
    // package's own dist/ and is included by "files": ["dist"]. Fails
    // loudly rather than silently shipping a CLI without it, in case this
    // build ever runs outside turbo's dependency graph (e.g. a bare
    // `pnpm --filter @interview-sdk/cli build`).
    const dashboardDist = '../dashboard/dist';
    if (!existsSync(dashboardDist)) {
      throw new Error(
        `${dashboardDist} not found — build @interview-sdk/dashboard first ` +
          '(pnpm --filter @interview-sdk/dashboard build), or run the root `pnpm build`.',
      );
    }
    cpSync(dashboardDist, 'dist/dashboard', { recursive: true });
  },
});
