---
name: lint-fix
description: Run formatters, linters, and static analysis. Use when the user asks to fix lint, format code, run linters, fix linter errors, fix style, tidy code, run eslint --fix.
compatibility: Requires pnpm (or npm/yarn); project must define format/lint scripts.
---

# Lint Fix

## Trigger scenarios

Activate this skill when the user says or implies:

- Fix lint, fix linter errors, run formatters
- Format code, format and lint, fix style, tidy code
- Run eslint --fix, run prettier, fix formatting

## Order rule

Run **formatters first** (so the codebase is styled), then **linters with fix** (so auto-fix runs on consistent formatting).

## Commands for this repo

Run from the **repository root**.

- **Format (fix style):** `pnpm format` (trunk fmt), then `pnpm format:eslint` (eslint . --fix), then `pnpm format:prettier` (prettier --write .). If a script is missing in the project, skip it.
- **Lint with fix:** `pnpm lint:trunk` (trunk check -y). ESLint auto-fix is already covered by `pnpm format:eslint` above.
- **Structured feedback (AI agents):** Run `pnpm lint:report` first to get `lint-report.json` with score and violations. Then use `pnpm format:eslint` and `pnpm lint:eslint` to fix. See [docs/eslint-harness.md](../../docs/eslint-harness.md).

Single sequence:

```bash
pnpm format && pnpm format:eslint && pnpm format:prettier && pnpm lint:trunk
```

## Optional fixer loop

If violations remain after the above:

1. **Identify:** Read the lint/format output for remaining errors.
2. **Fix:** Apply the minimum necessary edit to resolve each reported issue.
3. **Verify:** Re-run the format + lint sequence.
4. Repeat until clean or up to 3 iterations to avoid unbounded loops.

## Example

Full fix (all formatters and lint-with-fix):

```bash
pnpm format && pnpm format:eslint && pnpm format:prettier && pnpm lint:trunk
```

## Other projects

If the project uses different package managers or scripts, run the equivalent from repo root, e.g. `npm run format`, `npm run lint:fix`, `eslint . --fix`, `prettier --write .`. Prefer the project's existing format and lint scripts when they exist.
