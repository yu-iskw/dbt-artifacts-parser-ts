---
name: lint-fix
description: Format code, run linters and static analysis, and find unused code (ESLint + Knip). Use when the user asks to fix lint, format code, run formatters, find dead code, unused exports, run knip, fix style, tidy code, or run eslint --fix.
compatibility: Requires pnpm from the repository root; expects `package.json` scripts and repo configs (`eslint.config.mjs`, `knip.json`). **Trunk** is recommended for parity with full `pnpm lint` / `pnpm format` but is **optional**—use `pnpm format:without-trunk` / `pnpm lint:without-trunk` when the `trunk` CLI is not installed.
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

**Use the layered flow:** format for consistent whitespace, ESLint for type-aware rules and unused bindings, Trunk for shared checks (when available), Knip for workspace graph (unused exports, files, dependencies).

## Trunk availability

**Detect:** from the repo root, `command -v trunk` or `which trunk`. Non-zero / empty output means Trunk is not on `PATH`.

| Situation           | Format                                                                             | Lint (full, no fix loops)                                                                  |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Trunk available** | `pnpm format`                                                                      | `pnpm lint`                                                                                |
| **Trunk missing**   | `pnpm format:without-trunk` (same as `pnpm format:eslint && pnpm format:prettier`) | `pnpm lint:without-trunk` (same as `pnpm lint:eslint && pnpm lint:stylelint && pnpm knip`) |

Do **not** run `pnpm format` or `pnpm lint` when Trunk is missing: both scripts invoke `trunk` first and will fail immediately.

**Coverage gap (no Trunk):** [.trunk/trunk.yaml](../../../.trunk/trunk.yaml) enables additional checks (e.g. markdownlint, taplo, shellcheck, actionlint, Trivy, OSV, yamllint) that the no-Trunk path does **not** run. The no-Trunk path matches most **TypeScript / React / CSS / dead-code** work and aligns with agent gates in [`AGENTS.md`](../../../AGENTS.md) (`lint:report`, `knip`) **but** is not CI-identical. Before merge or when editing markdown, YAML, shell, or workflow files, run `pnpm lint` in an environment with Trunk when possible.

**CSS note:** `pnpm lint:report` is **ESLint-only** (writes `lint-report.json`). It does **not** run Stylelint. After substantive edits to `packages/dbt-tools/web/src/**/*.css`, run **`pnpm lint:stylelint`** or full `pnpm lint` (with Trunk) so Stylelint rules (e.g. deprecated properties) are caught.

## Order rule

### Path A — Trunk available

1. **Format first** — `pnpm format` (`trunk fmt` → `eslint . --fix` → `prettier --write .`).
2. **Lint** — `pnpm lint` (`lint:trunk` → `lint:eslint` → `lint:stylelint` → `knip`), or a slimmer pass: `pnpm lint:trunk && pnpm lint:eslint && pnpm lint:stylelint` (omit Knip if not needed yet).

### Path B — Trunk missing

1. **Format first** — `pnpm format:without-trunk` (or `pnpm format:eslint && pnpm format:prettier`). **Do not** use `pnpm format`.
2. **Lint** — `pnpm lint:without-trunk` (or the same chain manually). **Do not** use `pnpm lint`.

3. **Dead code** — `pnpm knip` is already at the end of `lint:without-trunk`; treat **`pnpm knip:fix`** as review-only (it can remove exports and files).

Do **not** treat `knip --fix` as a formatter. Prefer manual or reviewed edits for removals.

## Config pointers (this repo)

- **ESLint:** [`eslint.config.mjs`](../../../eslint.config.mjs) — TypeScript recommended + `@typescript-eslint/no-unused-vars`, **`@typescript-eslint/no-unused-private-class-members`** on production `packages/**/*.ts(x)` (excludes `*.test.*` and e2e specs). React / a11y / hooks for web TSX. Fix via `pnpm format:eslint` and `pnpm lint:eslint`.
- **Knip:** [`knip.json`](../../../knip.json) — per-workspace entries (Vitest, parser, core, CLI, web + Vite/Playwright), **`ignoreExportsUsedInFile`**, targeted **`ignoreIssues`** / **`ignoreFiles`** / **`ignoreDependencies`** / **`ignoreBinaries`**. Decision record: [`docs/adr/0031-knip-and-eslint-layers-for-monorepo-dead-code-detection.md`](../../../docs/adr/0031-knip-and-eslint-layers-for-monorepo-dead-code-detection.md).

## Commands for this repo

Run from the **repository root**.

| Step                      | Command                     | Purpose                                                           |
| ------------------------- | --------------------------- | ----------------------------------------------------------------- |
| Format (with Trunk)       | `pnpm format`               | `trunk fmt` → `eslint . --fix` → `prettier --write .`             |
| Format (no Trunk)         | `pnpm format:without-trunk` | `eslint . --fix` → `prettier --write .` only                      |
| Lint full (with Trunk)    | `pnpm lint`                 | `lint:trunk` → `lint:eslint` → `lint:stylelint` → **`knip`**      |
| Lint full (no Trunk)      | `pnpm lint:without-trunk`   | `lint:eslint` → `lint:stylelint` → **`knip`** (no Trunk)          |
| ESLint report (agents)    | `pnpm lint:report`          | Writes `lint-report.json`; ESLint-only; must exit **0** for green |
| Stylelint (web CSS)       | `pnpm lint:stylelint`       | `packages/dbt-tools/web/src/**/*.css`                             |
| Dead code (analyze)       | `pnpm knip`                 | Unused exports/files/deps; must exit **0** when clean             |
| Dead code (assisted edit) | `pnpm knip:fix`             | Review diff before commit                                         |

**Typical fix sequence — Trunk available:**

```bash
pnpm format && pnpm lint:trunk && pnpm lint:eslint && pnpm lint:stylelint && pnpm knip
```

(Equivalent high-level: `pnpm format` then `pnpm lint`.)

**Typical fix sequence — Trunk unavailable:**

```bash
pnpm format:without-trunk && pnpm lint:without-trunk
```

## Optional fixer loop

If violations remain:

1. **Identify:** Read ESLint / Trunk / Stylelint / Knip output.
2. **Fix:** Minimal edits; for Knip, prefer removing dead code or narrowing **`knip.json`** with a short rationale (shell-only scripts, dynamic imports, published API).
3. **Verify:**
   - **Trunk available:** re-run `pnpm format` (or at least ESLint + Prettier), then `pnpm lint:eslint`, **`pnpm knip`**, **`pnpm lint:report`**.
   - **Trunk missing:** re-run **`pnpm format:without-trunk`**, **`pnpm lint:without-trunk`**, **`pnpm lint:report`**.
   - For CSS-heavy changes, include **`pnpm lint:stylelint`** in verify if you did not run full `pnpm lint` / `pnpm lint:without-trunk`.
   - Before relying on CI: run **`pnpm lint`** where Trunk is installed when possible.
4. Repeat up to **3** iterations to avoid unbounded loops.

**Policy:** Fix root causes; avoid blanket `eslint-disable` or widening ignores unless unavoidable (see [`AGENTS.md`](../../../AGENTS.md) quality gates).

## Verifier integration

When used by the verifier agent, confirm at minimum:

- `pnpm lint:report` exits **0**
- `pnpm knip` exits **0**

When **Trunk is unavailable**, also run **`pnpm lint:eslint`** and **`pnpm lint:stylelint`** (or a single **`pnpm lint:without-trunk`**) so non-ESLint issues (especially CSS) are not missed.

Re-run the relevant commands after fixes before marking the step complete.

## Other projects

If scripts differ, prefer the repo’s `package.json` **format** / **lint** / **knip** (or equivalent) names. Keep the same **order**: format → lint fixes → dead-code graph tool if present. If Trunk-equivalent tooling is optional there too, document a no-Trunk subset the same way.
