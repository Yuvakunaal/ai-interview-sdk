# @interview-sdk/coding

Sandboxed code execution and evaluation for Coding Interview Mode: compile/
runtime error handling, timeout/infinite-loop detection, partial-solution
scoring, complexity analysis.

> **Status:** scaffold only. Built in Phase 7, as its own package deliberately
> — a sandbox-escape vulnerability here must not be able to compromise
> `@interview-sdk/core`, `@interview-sdk/server`, or any other package.

## Why a separate package

Per §16 of the product spec, code execution is the highest-risk subsystem in
the SDK. Isolating it as its own package (rather than a submodule inside
`server`) means:

- It can be audited, versioned, and security-patched independently.
- A developer who doesn't need Coding Interview Mode never installs it, and
  never runs the sandbox executor at all.
- The dependency boundary is enforced by the package boundary, not just
  convention.

## Sandbox technology (planned for Phase 7)

`vm2` and Node's built-in `vm` module are explicitly **not** used here — both
are documented as escapable and not real security boundaries. The default
executor will shell out to Docker (`--network=none`, read-only rootfs,
memory/CPU/pid limits, wall-clock timeout) for genuine OS-level isolation,
behind a pluggable `CodeExecutionProvider` interface so developers without
Docker (e.g. serverless) can swap in a hosted sandbox (Piston, Judge0, E2B).
