import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // A regression floor, not an aspirational target — set safely below
      // this package's real measured coverage (~89/86/91/90 at the time
      // this was added, the lowest of any package here, dragged down by
      // two browser-audio-analysis hooks that are hard to unit test), so
      // it only fails if coverage actually drops.
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 85,
      },
    },
  },
});
