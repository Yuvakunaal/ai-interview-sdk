import { copyFileSync, mkdirSync } from 'node:fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['react', 'react-dom'],
  onSuccess: async () => {
    mkdirSync('dist', { recursive: true });
    copyFileSync('src/styles.css', 'dist/styles.css');
  },
});
