# @interview-sdk/coding

Sandboxed code execution and evaluation for Coding Interview Mode: compile/
runtime error handling, timeout/infinite-loop detection, partial-solution
scoring, an empirical complexity check, and hardcoded-solution detection.

## Why a separate package

Per §16 of the product spec, code execution is the highest-risk subsystem in
the SDK. Isolating it as its own package (rather than a submodule inside
`server`) means:

- It can be audited, versioned, and security-patched independently.
- A developer who doesn't need Coding Interview Mode never installs it, and
  never runs the sandbox executor at all.
- The dependency boundary is enforced by the package boundary, not just
  convention.

## Install

```bash
npm install @interview-sdk/core @interview-sdk/coding
```

## Usage

```ts
import { CodingEvaluationEngine, DockerCodeExecutionProvider } from '@interview-sdk/coding';

const provider = new DockerCodeExecutionProvider();
const engine = new CodingEvaluationEngine(provider);

const result = await engine.evaluate(
  {
    id: 'two-sum',
    prompt: 'Read two integers from stdin and print their sum.',
    language: 'javascript',
    testCases: [
      { id: 't1', input: '2 3', expectedOutput: '5' },
      { id: 't2', input: '10 -4', expectedOutput: '6', hidden: true },
    ],
    timeLimitMs: 3000,
    referenceComplexity: 'O(n)',
  },
  { code: candidateCode, language: 'javascript' },
);

// result.totalScore, result.passedCount/totalCount, result.flags, result.complexityNote
```

## Sandbox providers

`vm2` and Node's built-in `vm` module are deliberately **not** used here —
both are documented as escapable and not real security boundaries for
untrusted code.

- **`DockerCodeExecutionProvider`** (default) — shells out to `docker run`
  for genuine OS-level isolation: `--network=none`, a read-only root
  filesystem, memory/CPU/process-count limits, a non-root user, every Linux
  capability dropped (`--cap-drop=ALL`), `--security-opt=no-new-privileges`,
  and default runtime images pinned by digest rather than a mutable tag.
  Requires Docker on whatever machine runs it (your backend or CI — never a
  maintainer-hosted service, per the Zero-Infra Guarantee).
- **`PistonCodeExecutionProvider`** — a hosted-sandbox alternative for
  environments without Docker (e.g. serverless). Piston's public instance
  went whitelist-only in 2026; Piston ships as a single Docker image built
  for self-hosting, so point `baseUrl` at your own instance.

Both implement the same `CodeExecutionProvider` interface — swap one for the
other, or write your own (Judge0, E2B, anything), without touching
`CodingEvaluationEngine`.

```ts
import { PistonCodeExecutionProvider } from '@interview-sdk/coding';

const provider = new PistonCodeExecutionProvider({
  baseUrl: 'https://your-piston-instance.example.com/api/v2',
});
```

## Heuristics, honestly labeled

- **Empirical complexity check** — rather than statically parsing the
  candidate's code (unreliable in general), this compares how execution
  time actually grew between the smallest- and largest-input passing test
  cases against the question's declared `referenceComplexity`. Requires at
  least two test cases with distinct `inputSize` values; without that it
  reports nothing rather than guessing. Sandbox timing noise means this is a
  signal worth a second look, not a verdict — see `complexity-heuristics.ts`.
- **Hardcoded-solution detection** — flags a fully-passing submission whose
  source literally contains every expected test-case output as a string.
  Cheap and honest, but not exhaustive: it won't catch hardcoding that
  computes an index into a lookup table, for instance.

## Not yet implemented

- Plagiarism and AI-generated-code detection (§8) — out of scope for this
  phase.
- Multi-file submissions and hidden-test-evaluation reporting UI — the
  engine already runs hidden test cases and omits their input/output from
  the result, but there's no multi-file support yet.
- Only JavaScript and Python ship as default Docker runtimes; add more via
  the `languages` config option.
- The default runtimes' pinned image digests (see `DEFAULT_LANGUAGE_RUNTIMES`
  in `docker-provider.ts`) don't pick up upstream security patches on their
  own — they need periodic manual refresh (`docker buildx imagetools
  inspect <image>:<tag>`), or override `languages` with your own image
  reference if you'd rather track a tag directly.
