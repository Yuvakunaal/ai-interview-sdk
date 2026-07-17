import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // A regression floor, not an aspirational target — set safely below
      // this package's real measured coverage at the time this was added.
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 85,
      },
    },
  },
});
