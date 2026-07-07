# @interview-sdk/landing

The `@interview-sdk` marketing/landing page — a static React site (Vite),
deployable standalone to any static host (Vercel, Netlify, GitHub Pages,
Cloudflare Pages).

Ported from the original design artifact with pixel-fidelity: same colors,
type scale, layout, and copy, verbatim — this is a faithful React port, not
a redesign. `src/App.css` is the same CSS custom-property token system
(`--paper`/`--ink`/`--accent`/etc.) as the artifact, just moved from an
inline `<style>` tag into its own file; nothing in it was changed. Both
light and dark mode (`prefers-color-scheme`, plus `data-theme` overrides if
you wire up a toggle later) are preserved as-is.

## Develop

```bash
pnpm --filter @interview-sdk/landing dev
```

## Build

```bash
pnpm --filter @interview-sdk/landing build
```

Outputs static assets to `dist/` — deploy that directory as-is to any
static host. No environment variables, no backend, no build-time secrets.

## Test

```bash
pnpm --filter @interview-sdk/landing test
```

## Updating the copy or data

The scripted-persona scorecard and the spec-sheet rows are both driven by
small typed arrays (`PERSONA_ROWS`, `SPEC_ROWS`) at the top of `src/App.tsx`
— edit those rather than the JSX markup below them.
