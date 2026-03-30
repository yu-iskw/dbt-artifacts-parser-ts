---
name: lint-fix
description: Format code, run linters and static analysis, and find unused code (ESLint + Knip). Use when the user asks to fix lint, format code, run formatters, find dead code, unused exports, run knip, fix style, tidy code, or run eslint --fix.
compatibility: Requires pnpm from the repository root; expects `package.json` scripts and repo configs (`eslint.config.mjs`, `knip.json`).
---

# Lint Fix

## Trigger scenarios

Activate this skill when the user says or implies:

- Fix lint, fix linter errors, run linters, run static analysis
- **Format code**, format and lint, fix style, tidy code
- Run **eslint --fix**, run prettier, run trunk fmt / trunk check
- Find **unused code**, **dead code**, unused exports, unused files, or run **Knip**

## Why this stack (short)

| Approach                                 | Feasibility | Maintainability | Fit for agents                              | Score  |
| ---------------------------------------- | ----------- | --------------- | ------------------------------------------- | ------ |
| ESLint only for “unused”                 | High        | High            | Misses cross-package unused exports         | 55     |
| Knip only                                | High        | Medium          | Misses many intra-file issues ESLint covers | 60     |
| Format + ESLint + Trunk + Knip (layered) | High        | High            | Clear order, matches repo scripts           | **92** |
| Bundle / tree-shake reports as primary   | Medium      | Low             | Indirect, poor for “delete this symbol”     | 40     |
| IDE-only cleanup                         | Low         | Low             | Not reproducible in CI or agents            | 25     |

**Use the layered flow:** format for consistent whitespace, ESLint for type-aware rules and unused bindings, Trunk for shared checks, Knip for workspace graph (unused exports, files, dependencies).

## Order rule

1. **Format first** — Trunk format, then ESLint `--fix`, then Prettier (`pnpm format`), so fixes apply on consistent layout.
2. **Lint with auto-fix** — Trunk check, full ESLint (no fix), Stylelint for web CSS (`pnpm lint` minus Knip if you need a slimmer pass).
3. **Dead code last** — Run **`pnpm knip`** (read-only). Use **`pnpm knip:fix`** only after reviewing what Knip would change; it can remove exports and files.

Do **not** treat `knip --fix` as a formatter. Prefer manual or reviewed edits for removals.

## Config pointers (this repo)

- **ESLint:** [`eslint.config.mjs`](../../../eslint.config.mjs) — TypeScript recommended + `@typescript-eslint/no-unused-vars`, **`@typescript-eslint/no-unused-private-class-members`** on production `packages/**/*.ts(x)` (excludes `*.test.*` and e2e specs). React / a11y / hooks for web TSX. Fix via `pnpm format:eslint` and `pnpm lint:eslint`.
- **Knip:** [`knip.json`](../../../knip.json) — per-workspace entries (Vitest, parser, core, CLI, web + Vite/Playwright), **`ignoreExportsUsedInFile`**, targeted **`ignoreIssues`** / **`ignoreFiles`** / **`ignoreDependencies`** / **`ignoreBinaries`**. Decision record: [`docs/adr/0031-knip-and-eslint-layers-for-monorepo-dead-code-detection.md`](../../../docs/adr/0031-knip-and-eslint-layers-for-monorepo-dead-code-detection.md).

## Commands for this repo

Run from the **repository root**.

| Step                      | Command            | Purpose                                                                    |
| ------------------------- | ------------------ | -------------------------------------------------------------------------- |
| Format                    | `pnpm format`      | `trunk fmt` → `eslint . --fix` → `prettier --write .`                      |
| Lint (full)               | `pnpm lint`        | `lint:trunk` → `lint:eslint` → `lint:stylelint` → **`lint:knip`** (`knip`) |
| ESLint report (agents)    | `pnpm lint:report` | Writes `lint-report.json`; must exit **0** for green                       |
| Dead code (analyze)       | `pnpm knip`        | Unused exports/files/deps; must exit **0** when clean                      |
| Dead code (assisted edit) | `pnpm knip:fix`    | Review diff before commit                                                  |

**Typical fix sequence:**

```bash
pnpm format && pnpm lint:trunk && pnpm lint:eslint && pnpm lint:stylelint && pnpm knip
```

If Trunk is unavailable in the environment, run:

```bash
pnpm format:eslint && pnpm format:prettier && pnpm lint:eslint && pnpm lint:stylelint && pnpm knip
```

## Optional fixer loop

If violations remain:

1. **Identify:** Read ESLint / Trunk / Stylelint / Knip output.
2. **Fix:** Minimal edits; for Knip, prefer removing dead code or narrowing **`knip.json`** with a short rationale (shell-only scripts, dynamic imports, published API).
3. **Verify:** Re-run `pnpm format` (or ESLint+Prettier), then `pnpm lint:eslint`, then **`pnpm knip`**, then **`pnpm lint:report`**.
4. Repeat up to **3** iterations to avoid unbounded loops.

**Policy:** Fix root causes; avoid blanket `eslint-disable` or widening ignores unless unavoidable (see [`AGENTS.md`](../../../AGENTS.md) quality gates).

## Verifier integration

When used by the verifier agent, confirm **both**:

- `pnpm lint:report` exits **0**
- `pnpm knip` exits **0**

Re-run both after fixes before marking the step complete.

## Other projects

If scripts differ, prefer the repo’s `package.json` **format** / **lint** / **knip** (or equivalent) names. Keep the same **order**: format → lint fixes → dead-code graph tool if present.
