// Minimal ambient declaration for the NODE_ENV production-guard check in
// InterviewWidget. Deliberately not pulling in @types/node — this is a
// browser package, and bundlers (Vite/webpack/Next.js) statically replace
// `process.env.NODE_ENV` at build time regardless of a real Node runtime.
declare const process: { env?: { NODE_ENV?: string } } | undefined;
