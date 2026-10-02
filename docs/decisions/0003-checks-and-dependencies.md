# 0003: Checks and dependencies

**Status:** accepted
**Date:** 2026-10-02

## Context
clean-project wants one check command, a formatter, a strict linter, a structure check and tests, with pinned
versions and as few dependencies as possible.

## Options
- Vitest or Jest for tests, or the Node test runner, which runs TypeScript directly since Node 23.
- Zod or a hand-written validator for `.scratchii` files and sync requests.
- Express or Fastify for the sync server, or `node:http` with `node:sqlite`.

## Decision
- `npm run check` runs `tools/check.ts`: prettier, eslint (typescript-eslint strict, size limits as rules),
  `tsc --noEmit`, `tools/structure.ts`, `node --test`, and `cargo fmt --check` plus `cargo clippy` once
  `src-tauri/` exists. It stops at the first failure and runs with the lowest CPU and I/O priority.
- TypeScript only with erasable syntax (`erasableSyntaxOnly`), so Node runs the same files the bundler does.
- The validator is hand-written next to the model; the sync server uses only the Node standard library.
- TypeScript stays on 6.0 because typescript-eslint does not support 7 yet.

## Consequences
- No transpile step for tests or the server; relative imports carry the `.ts` extension.
- Every new dependency needs a reason in its commit message, large ones an ADR.
