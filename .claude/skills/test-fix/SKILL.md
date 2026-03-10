---
name: test-fix
description: Run unit tests and fix failures. Use when the user asks to run tests, fix failing tests, make tests pass, tests are broken, fix test errors, or get tests green.
compatibility: Requires pnpm (or npm/yarn); project must define a test script.
---

# Test Fix

## Trigger scenarios

Activate this skill when the user says or implies:

- Run tests, fix failing tests, make tests pass
- Tests failed, tests are broken, fix test errors, get tests green

## Purpose

Run the test suite; if it fails, read the output, apply minimal fixes, and re-run until tests pass or an iteration limit is reached.

## Commands for this repo

Run from the **repository root**.

- **Test:** `pnpm test` (runs `pnpm --recursive test`; the package uses `vitest run`).

## Fixer loop

1. **Run:** Execute `pnpm test` from the repository root.
2. **Identify:** Read the test output for failing file, test name, and assertion or error message.
3. **Fix:** Apply the minimum necessary change (assertion, fixture, code under test, or mock) to resolve the failure. Prefer one logical fix per iteration.
4. **Verify:** Re-run `pnpm test`.
5. **Repeat** until all tests pass or up to **5 iterations** to avoid unbounded loops.

## Common error types

- **Assertion mismatch:** Adjust the expectation or fix the implementation to match the intended behavior.
- **Type / snapshot / import errors:** Fix types, snapshot, or imports in the reported file.
- **Missing or stale fixtures:** Update test data or paths.

## Example

First run (tests fail):

```bash
pnpm test
```

After editing files to fix reported failures:

```bash
pnpm test
```

## Other projects

If the project uses a different package manager or test command, run the equivalent from the repo root (e.g. `npm test`, `yarn test`, `pnpm test`, `cargo test`). Use the same fixer loop: run tests → read failures → fix → re-run.
