export interface HtmlToImageOptions {
  backgroundColor?: string;
  pixelRatio?: number;
  filter?: (domNode: HTMLElement) => boolean;
}

export interface HtmlToImageModule {
  toPng<T extends HTMLElement>(node: T, options?: HtmlToImageOptions): Promise<string>;
}

/**
 * A literal `import('html-to-image')` — not hidden behind a `new
 * Function(...)`-constructed specifier. That trick (used here previously)
 * makes bundlers skip the import entirely at build time, but a bare
 * specifier built that way can never resolve at runtime either: per the
 * ECMAScript/WHATWG module spec, native `import()` of a bare specifier
 * only resolves via an import map or a bundler's own static rewrite —
 * hiding the call from every bundler (verified against real Vite dev and
 * production builds) means no bundler ever rewrites it, so it fails with
 * "Failed to resolve module specifier" in every real browser, always,
 * even when the consumer has installed the package. A literal import()
 * is what Vite/webpack/Rollup can actually see and correctly resolve (to
 * the real module when installed, or a normal build error when it truly
 * isn't) — this package's own build (tsup) is told to treat
 * `html-to-image` as `external` (see tsup.config.ts) so it never needs to
 * be installed just to build `@interview-sdk/react` itself.
 */
export async function loadHtmlToImage(): Promise<HtmlToImageModule> {
  return (await import('html-to-image')) as unknown as HtmlToImageModule;
}
