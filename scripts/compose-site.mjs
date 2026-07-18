// Merges the two independently-built static sites into one deployable tree:
// packages/landing/dist (served at /) + packages/docs/out (served at /docs,
// which is why packages/docs/next.config.mjs sets basePath: '/docs' — every
// asset/link Next emits already expects to live one directory down from
// wherever this script places it).
//
// The composed result is also mirrored to a repo-root ./dist — Vercel's
// dashboard "Output Directory" field has repeatedly reverted to its
// Vite-framework default of "dist" regardless of what's configured there or
// in vercel.json, so rather than keep fighting that UI, the build now just
// makes a real "dist" exist at the repo root too.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const landingDist = path.join(root, 'packages/landing/dist');
const docsOut = path.join(root, 'packages/docs/out');
const docsDest = path.join(landingDist, 'docs');
const rootDist = path.join(root, 'dist');

for (const [label, dir] of [['landing/dist', landingDist], ['docs/out', docsOut]]) {
  if (!existsSync(dir)) {
    console.error(`compose-site: expected ${label} at ${dir} — build it first.`);
    process.exit(1);
  }
}

cpSync(docsOut, docsDest, { recursive: true });
console.log(`compose-site: copied ${docsOut} -> ${docsDest}`);

rmSync(rootDist, { recursive: true, force: true });
cpSync(landingDist, rootDist, { recursive: true });
console.log(`compose-site: mirrored ${landingDist} -> ${rootDist}`);
