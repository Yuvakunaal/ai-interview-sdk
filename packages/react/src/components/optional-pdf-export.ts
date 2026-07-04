export interface JsPdfInstance {
  text(text: string, x: number, y: number): unknown;
  save(filename: string): unknown;
}

export interface JsPdfModule {
  default: new () => JsPdfInstance;
}

/**
 * Loads an optional peer dependency by name via a specifier no bundler can
 * statically see (constructed inside a `Function` body, not a literal
 * `import()` in this module's own AST) — so tsup/esbuild, Vite, and
 * webpack all leave it fully unresolved until it actually runs, instead of
 * failing the build/dev-transform when the dependency isn't installed.
 */
function loadOptionalModule(specifier: string): Promise<unknown> {
  const dynamicImport = new Function('id', 'return import(id)') as (id: string) => Promise<unknown>;
  return dynamicImport(specifier);
}

export async function loadJsPdf(): Promise<JsPdfModule> {
  return (await loadOptionalModule('jspdf')) as JsPdfModule;
}
