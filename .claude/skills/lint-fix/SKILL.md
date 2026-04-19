---
name: lint-fix
description: Format code, run linters and static analysis, and find unused code (ESLint + Knip). Use when the user asks to fix lint, format code, run formatters, find dead code, unused exports, run knip, fix style, tidy code, or run eslint --fix.
compatibility: Requires pnpm from the repository root; expects `package.json` scripts and repo configs (`eslint.config.mjs`, `knip.json`). The **default** path assumes **`pnpm install`** has been run so **`@trunkio/launcher`** is present; use **`pnpm format:without-trunk`** / **`pnpm lint:without-trunk`** only as an escape hatch for **broken or minimal** environments where `trunk` cannot run.
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

**Default (this monorepo):** From the repository root, run **`pnpm install`** so **`@trunkio/launcher`** is installed. Then use **`pnpm format`** / **`pnpm lint`**, or **`pnpm exec trunk check`**, **`pnpm exec trunk fmt`**, for full parity with CI. **`pnpm`** puts `node_modules/.bin` on `PATH` when running package scripts, but a bare interactive shell often does **not**—so **`command -v trunk`** / **`which trunk`** are **not** authoritative; do not use them alone to decide if Trunk is usable.

**Optional checks** (from repo root): `test -x node_modules/.bin/trunk`, or **`pnpm exec trunk version`**.

| Situation                                 | Format                                                                             | Lint (full, no fix loops)                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Use pnpm scripts (launcher present)**   | `pnpm format`                                                                      | `pnpm lint`                                                                                |
| **Launcher missing / cannot run `trunk`** | `pnpm format:without-trunk` (same as `pnpm format:eslint && pnpm format:prettier`) | `pnpm lint:without-trunk` (same as `pnpm lint:eslint && pnpm lint:stylelint && pnpm knip`) |

Do **not** run `pnpm format` or `pnpm lint` when the launcher cannot execute `trunk` (e.g. missing `node_modules` or failed install): both scripts invoke `trunk` first and will fail immediately. The **`*:without-trunk`** scripts are an **escape hatch**, not the normal workflow here.

**Coverage gap (no Trunk):** [.trunk/trunk.yaml](../../../.trunk/trunk.yaml) enables additional checks (e.g. markdownlint, taplo, shellcheck, actionlint, Trivy, OSV, yamllint) that the no-Trunk path does **not** run. The no-Trunk path matches most **TypeScript / React / CSS / dead-code** work and aligns with agent gates in [`AGENTS.md`](../../../AGENTS.md) (`lint:report`, `knip`) **but** is not CI-identical. Before merge or when editing markdown, YAML, shell, or workflow files, run `pnpm lint` in an environment with Trunk when possible.

**CSS note:** `pnpm lint:report` is **ESLint-only** (writes `lint-report.json`). It does **not** run Stylelint. After substantive edits to `packages/dbt-tools/web/src/**/*.css`, run **`pnpm lint:stylelint`** or full `pnpm lint` (with Trunk) so Stylelint rules (e.g. deprecated properties) are caught.

## Order rule

### Path A — Launcher present (`pnpm format` / `pnpm lint`)

1. **Format first** — `pnpm format` (`trunk fmt` → `eslint . --fix` → `prettier --write .`).
2. **Lint** — `pnpm lint` (`lint:trunk` → `lint:eslint` → `lint:stylelint` → `knip`), or a slimmer pass: `pnpm lint:trunk && pnpm lint:eslint && pnpm lint:stylelint` (omit Knip if not needed yet).
3. **Build gate for broad shared TS refactors** — after the first green **`pnpm lint:eslint`** checkpoint, if the touched files include `packages/dbt-tools/core`, `packages/dbt-tools/cli`, shared TypeScript utilities, worker protocol layers, or exported types/helpers, run **`pnpm build`** from the repo root. If it fails, switch to [`.claude/skills/build-fix/SKILL.md`](../build-fix/SKILL.md) and follow its fixer loop before claiming the lint session is complete.

### Path B — Escape hatch (`*:without-trunk`)

1. **Format first** — `pnpm format:without-trunk` (or `pnpm format:eslint && pnpm format:prettier`). **Do not** use `pnpm format`.
2. **Lint** — `pnpm lint:without-trunk` (or the same chain manually). **Do not** use `pnpm lint`.

3. **Dead code** — `pnpm knip` is already at the end of `lint:without-trunk`; treat **`pnpm knip:fix`** as review-only (it can remove exports and files).

Do **not** treat `knip --fix` as a formatter. Prefer manual or reviewed edits for removals.

## Config pointers (this repo)

- **ESLint:** [`eslint.config.mjs`](../../../eslint.config.mjs) — TypeScript recommended + `@typescript-eslint/no-unused-vars`, **`@typescript-eslint/no-unused-private-class-members`** on production `packages/**/*.ts(x)` (excludes `*.test.*` and e2e specs). React / a11y / hooks for web TSX. Fix via `pnpm format:eslint` and `pnpm lint:eslint`.
- **Knip:** [`knip.json`](../../../knip.json) — per-workspace entries (Vitest, parser, core, CLI, web + Vite/Playwright), **`ignoreExportsUsedInFile`**, targeted **`ignoreIssues`** / **`ignoreFiles`** / **`ignoreDependencies`** / **`ignoreBinaries`**. Decision record: [`docs/adr/0005-knip-and-eslint-layers-for-monorepo-dead-code-detection.md`](../../../docs/adr/0005-knip-and-eslint-layers-for-monorepo-dead-code-detection.md).

## Commands for this repo

Run from the **repository root**.

| Step                      | Command                     | Purpose                                                           |
| ------------------------- | --------------------------- | ----------------------------------------------------------------- |
| Format (launcher path)    | `pnpm format`               | `trunk fmt` → `eslint . --fix` → `prettier --write .`             |
| Format (escape hatch)     | `pnpm format:without-trunk` | `eslint . --fix` → `prettier --write .` only                      |
| Lint full (launcher path) | `pnpm lint`                 | `lint:trunk` → `lint:eslint` → `lint:stylelint` → **`knip`**      |
| Lint full (escape hatch)  | `pnpm lint:without-trunk`   | `lint:eslint` → `lint:stylelint` → **`knip`** (no Trunk)          |
| ESLint report (agents)    | `pnpm lint:report`          | Writes `lint-report.json`; ESLint-only; must exit **0** for green |
| Stylelint (web CSS)       | `pnpm lint:stylelint`       | `packages/dbt-tools/web/src/**/*.css`                             |
| Dead code (analyze)       | `pnpm knip`                 | Unused exports/files/deps; must exit **0** when clean             |
| Dead code (assisted edit) | `pnpm knip:fix`             | Review diff before commit                                         |

**Typical fix sequence — launcher present:**

```bash
pnpm format && pnpm lint:trunk && pnpm lint:eslint && pnpm lint:stylelint && pnpm knip
```

(Equivalent high-level: `pnpm format` then `pnpm lint`.)

**Typical fix sequence — escape hatch:**

```bash
pnpm format:without-trunk && pnpm lint:without-trunk
```

## Optional fixer loop

If violations remain:

1. **Identify:** Read ESLint / Trunk / Stylelint / Knip output.
2. **Fix:** Minimal edits; for Knip, prefer removing dead code or narrowing **`knip.json`** with a short rationale (shell-only scripts, dynamic imports, published API).
3. **Verify:**
   - **Launcher present:** re-run `pnpm format` (or at least ESLint + Prettier), then `pnpm lint:eslint`, **`pnpm knip`**, **`pnpm lint:report`**.
   - For broad shared TypeScript refactors, run **`pnpm build`** after the first green **`pnpm lint:eslint`** pass; if build breaks, use the **`build-fix`** skill loop before final verification.
   - **Escape hatch:** re-run **`pnpm format:without-trunk`**, **`pnpm lint:without-trunk`**, **`pnpm lint:report`**.
   - For CSS-heavy changes, include **`pnpm lint:stylelint`** in verify if you did not run full `pnpm lint` / `pnpm lint:without-trunk`.
   - For **Markdown**, **`.claude/`**, **`.github/workflows/`**, **`.trunk/`**, or other files Trunk owns, include **`pnpm lint:trunk`** (or full **`pnpm lint`**) when Trunk is available—**`pnpm lint:report` does not run markdownlint**.
   - Before relying on CI: run **`pnpm lint`** from a repo with **`pnpm install`** completed when possible.
4. Repeat up to **3** iterations to avoid unbounded loops.

**Policy:** Fix root causes; avoid blanket `eslint-disable` or widening ignores unless unavoidable (see [`AGENTS.md`](../../../AGENTS.md) quality gates).

## Verifier integration

The **verifier** subagent owns **step ordering**, **parallelism**, the **step 7 stability loop** (**`stability_iterations`**, cap **3**, and **which gates rerun** after normalization)—see [`.claude/agents/verifier.md`](../../../.claude/agents/verifier.md) **Step 7 — normalization stability loop (cap: 3)**.

### Full normalization (verifier step 7, loop item 1)

Use the **Order rule** above in this skill:

- **Path A — Launcher present:** **`pnpm format`** then **`pnpm lint`** (equivalent high-level sequence; see **Commands for this repo** and **Typical fix sequence — launcher present** for the decomposed chain).
- **Path B — Escape hatch:** **`pnpm format:without-trunk`** then **`pnpm lint:without-trunk`** when Trunk/launcher cannot run—see **Path B** under **Order rule**; do **not** use `pnpm format` / `pnpm lint` on Path B.

### After normalization leaves a dirty tree

When **`pnpm format` / `pnpm lint`** (Path A) or the Path B equivalents still leave **non-empty** `git status --porcelain`, the verifier **only** re-runs **steps 1–3** (lint report gate, unit test gate, coverage report gate)—not build, pack smoke, or CodeQL. See the verifier’s **Normalization: what reruns automatically vs what does not**.

### Minimum vs merge-ready (when acting for the verifier)

Confirm at minimum:

- **`pnpm lint:report`** exits **0** (ESLint-only; see **Commands** table — it does **not** run markdownlint or other Trunk linters).
- **`pnpm knip`** exits **0**

A **full** verifier run completes **step 7**, which includes **full lint** (Path A: **`pnpm lint`** includes **`pnpm lint:trunk`** and **Knip**). If you only run the minimum above and the change set touches **Markdown**, **`.claude/`**, **workflows**, or **`.trunk/`**, also run **`pnpm lint:trunk`** (or full **`pnpm lint`**) before claiming merge-ready so Trunk-owned checks match pre-push parity.

When using the **escape hatch** (`*:without-trunk`), also run **`pnpm lint:eslint`** and **`pnpm lint:stylelint`** (or a single **`pnpm lint:without-trunk`**) so non-ESLint issues (especially CSS) are not missed. Trunk-only checks (markdownlint, actionlint, etc.) still require **`pnpm lint:trunk`** / **`pnpm lint`** when the launcher is available.

Re-run the relevant commands after fixes before marking the step complete.

## Other projects

If scripts differ, prefer the repo’s `package.json` **format** / **lint** / **knip** (or equivalent) names. Keep the same **order**: format → lint fixes → dead-code graph tool if present. If Trunk-equivalent tooling is optional there too, document a no-Trunk subset the same way.
