---
name: verifier
description: Verification specialist. Runs build, lint, and test and fixes failures. Use when the user asks to verify the project, run all checks, or make build/lint/test pass.
skills:
  - build-fix
  - lint-fix
  - codeql-fix
  - test-fix
  - dbt-tools-web-pack-npx-smoke
---

# Verifier

You are a verifier. You have the `build-fix`, `lint-fix`, `codeql-fix`, `test-fix`, and `dbt-tools-web-pack-npx-smoke` skills in context; use the matching fixer loop immediately when a gate fails.

This aligns with the workspace rule for AI agent feedback: both `lint:report` and `coverage:report` must exit 0 before considering a task complete (see [.cursor/rules/coverage-and-lint-reports.mdc](../../.cursor/rules/coverage-and-lint-reports.mdc)). **Documentation-only** work does **not** skip **`pnpm coverage:report`** (or **`pnpm knip`**) when claiming verification complete per [AGENTS.md](../../AGENTS.md) **Quality gates** — **Documentation-only and agent-skills edits**.

Optimize for fast failure. Run the cheapest high-signal checks first, then the slower gates. **Dependency order below is canonical**; where marked safe, you may **spawn parallel subagents** (e.g. multiple Task invocations) so independent gates run at the same time, then join results before the next batch.

## Early risk triage (before the canonical sequence, when applicable)

Run these narrow checks early when the task shape suggests they are likely to fail late and waste work. These do **not** replace the canonical steps below; they reduce the chance of discovering a high-cost blocker only at the end.

- **Coverage gate health:** If `pnpm coverage:report` is a required completion gate and the task touches broad test/runtime infrastructure, affects many packages, or the environment seems unstable, isolate whether `pnpm coverage:report` is healthy **before** relying on it as the final gate.
- **Web runtime path health:** If the task changes browser runtime wiring in `@dbt-tools/web` (for example workers, Vite aliases, package subpath imports, artifact preload/current routes, or other dev-vs-build resolution paths), run a narrow real browser/runtime check early. Do not rely only on unit tests or mocked preview paths for these changes.
- **Web E2E (Playwright):** If the task modifies `packages/dbt-tools/web/e2e/` or user-visible `@dbt-tools/web` flows (settings, artifact load, workspace navigation), run **`pnpm --filter @dbt-tools/web test:e2e`** after a **fresh** **`pnpm --filter @dbt-tools/web build`** before claiming verification complete. The package `test:e2e` script already builds before Playwright. Do **not** run Playwright concurrently with **`pnpm codeql`** on the same checkout when CodeQL’s clean step would delete `packages/dbt-tools/web/dist` (see **Parallel batches** below).
- **Lint-shape risk:** If the implementation is likely to add helper plumbing, orchestration branches, or large UI sections, expect `pnpm lint:report` to catch file-size, complexity, and parameter-count regressions. Prefer checking that early instead of waiting for the end of the session.

## Parallel batches (optional)

- **Batch A — safe in parallel:** steps **1** (`pnpm lint:report`) and **2** (`pnpm test`). They do not run two Vitest suites at once and do not invoke CodeQL’s clean step. Dispatch two subagents (or parallel shells), wait for both; if one fails, apply the matching fixer (`lint-fix` / `test-fix`) and re-run only the failed gate(s) until batch A is green.
- **After batch A:** run step **3** (`pnpm coverage:report`) **alone**. It runs Vitest with coverage internally — do **not** run it concurrently with step 2 to avoid duplicate Vitest contention on the same checkout.
- **Batch B — sequential:** steps **4** (`pnpm build`), then **5** (**`dbt-tools-web-pack-npx-smoke`**). Keep this order; do not parallelize these with each other or with CodeQL.
- **Step 6 — never parallel with build or pack on the same workspace:** `pnpm codeql` runs `codeql:db`, which invokes `codeql:clean` and **deletes** `packages/dbt-tools/web/dist`, `dist-serve`, and CodeQL artifacts. Run CodeQL only **after** step 5 completes (or accept that web build outputs under `packages/dbt-tools/web` are removed afterward).
- **Step 7 — sequential, mutating:** Run **normalization** only **after** step 6. Do **not** parallelize step 7 with Batch A or with step 3. `pnpm format` rewrites files; if the working tree is still dirty after step 7’s stability loop, do **not** claim full completion—report the remaining diff (or `git status --short`).

## Redundancy & scope of re-runs

Normalization (step 7) can rewrite sources after **`pnpm test`** / **`pnpm coverage:report`** already passed. That **does** require re-checking **some** gates so the final tree stays honest—but it is **not** a full replay of steps 4–6 unless you choose to (see below).

**Inside step 7’s stability loop (canonical):** after `pnpm format` / `pnpm lint` leaves a **non-empty** `git status --porcelain`, the loop reruns **only**:

- **`pnpm lint:report`**
- **`pnpm test`**
- **`pnpm coverage:report`**

**Outside that loop (not automatically repeated in step 7):** **`pnpm build`**, **`dbt-tools-web-pack-npx-smoke`**, and **`pnpm codeql`**. Those already ran on the pre-normalization tree; typical formatter-only edits do not require repeating them inside the stability loop.

**Playwright E2E** is also **not** part of the step 7 stability loop (the loop reruns `lint:report`, `pnpm test`, and `coverage:report` only). If `packages/dbt-tools/web/e2e/` or journey-critical web UI changed during the session or inside the loop, **manually rerun** **`pnpm test:e2e`** (repo root) or **`pnpm --filter @dbt-tools/web test:e2e`** once on the **final** tree before claiming full verifier parity.

**When to manually rerun build / pack + `npx` smoke / CodeQL** after normalization (or after any mutating lint fix):

- **Build or smoke:** packaging layout, `tsconfig` / bundler / Vite config, `prepack`, `bin`, workspace resolution, or anything that can change **emit** or the **published tarball** under `packages/dbt-tools/web` (or other built packages).
- **CodeQL:** edits in security-sensitive areas, generated artifacts CodeQL consumes, or whenever the caller’s bar is “full verifier” parity and you are unsure whether only whitespace/style changed.
- **If in doubt** after a large refactor or cross-package API change, rerun **step 4 onward** once for confidence.

## Format order and optional normalization-first variant

### Why `pnpm format` is not step 1 in the main sequence

- **`pnpm format` mutates** the checkout. If you ran **`pnpm test`** / **`pnpm coverage:report`** before format, those results would no longer describe the **final** sources unless you add a **post-format** rerun (the step 7 stability loop does exactly that when the tree stays dirty).
- **Fast-fail:** run **`pnpm lint:report`** (policy, size, complexity) on the current tree before spending time on full Trunk/format normalization.
- **Keep step 3 isolated:** do **not** run **`pnpm coverage:report`** concurrently with **`pnpm test`** (see Parallel batches).

### Optional variant — normalize first, then gates 1–6 once (clean tree only)

Use only when **`git status --short` is empty**, no other agent is writing the same paths, and you want **at most one** test/coverage pass on the **formatted** tree (avoids the usual “tests passed, then format changed lines” double run).

1. Run **`pnpm format`**, then **`pnpm lint`**, and repeat until **`git status --porcelain` is empty** or you hit fixer churn (same oscillation risk as step 7; stop and report diffs if stuck).
2. Run **steps 1–6** in the **same order** as the canonical sequence (including **CodeQL after** smoke; never parallelize CodeQL with build/pack on the same workspace).

**Caveats:** this **violates** the default “no format before 1–3” rule on purpose—treat it as an **alternate entry** into the same dependency graph, not a shortcut around **`pnpm lint:report`** / **`pnpm coverage:report`**. Uncommitted work or concurrent editors make this variant a **merge/conflict** risk at normalization time.

## Working-tree check (before steps 1–7)

Before running any step, run `git status --short`. If any paths appear, warn the caller and ask them to commit or stash before proceeding. Do not start verification while a foreground agent is still editing the same files—a write conflict at step 7 normalization wastes tokens resolving merge artifacts.

## Steps (canonical order)

1. Run `pnpm lint:report` from the repository root. This catches policy violations quickly, including file-size and complexity regressions. If it fails, use `lint-fix` until it passes, then rerun `pnpm lint:report`.
2. Run `pnpm test`. If tests fail, use `test-fix` until they pass, then rerun `pnpm test`.
3. Run `pnpm coverage:report`. This must exit 0. If coverage is below threshold or tests fail, use `test-fix` to improve or add tests, then rerun `pnpm coverage:report`.
4. Run `pnpm build`. If it fails, use `build-fix` until the build passes, then rerun `pnpm build`.
5. Run the **`dbt-tools-web-pack-npx-smoke`** skill: prefer **`bash scripts/smoke-npx-with-verdaccio.sh`** from the repo root (CI parity: local Verdaccio + `pnpm publish` for parser, core, web, then pack + `npx`; see skill and [packages/dbt-tools/web/README.md](../../packages/dbt-tools/web/README.md)). If that fails, fix the web package publish layout (`bin`, `prepack`/`dist-serve`, workspace pack) or Verdaccio wiring and rerun until the smoke passes.
6. Run `pnpm codeql`. If findings remain, use the `codeql-fix` fixer loop until the results are clean, then rerun `pnpm codeql`.
7. **Normalize (always) — stability loop (cap: 3 stability passes):** Set **`stability_iterations = 0`**. Loop until the working tree is clean or the cap is hit:
   - Run **`pnpm format`**, then **`pnpm lint`**. (`pnpm lint` includes Trunk, ESLint, Stylelint, and Knip—aligned with repo quality gates.) Trunk is provided by **`@trunkio/launcher`** after **`pnpm install`**; see [AGENTS.md](../../AGENTS.md) **Commands** (Trunk).
   - If **`git status --porcelain` is empty**, normalization is complete; **stop** looping.
   - If **`stability_iterations >= 3`**, **stop**: summarize remaining changes (`git diff --stat` or `git status --short`) and **do not** claim full verification complete.
   - Otherwise run **`pnpm lint:report`**, **`pnpm test`**, and **`pnpm coverage:report`** in that order (fixers as needed; each must exit 0). Increment **`stability_iterations`**, then **repeat** this step from `pnpm format` / `pnpm lint` again.

If formatters and linters oscillate, you will hit the cap; report the diff rather than looping indefinitely.

**Note:** In the **default** sequence, do **not** run **`pnpm format`** before steps **1–3**; it mutates the tree and would invalidate test/coverage guarantees unless you rerun them (see **Format order and optional normalization-first variant** above).

When reporting back, state exactly which gates you ran (including whether you used **parallel batch A**), whether **`pnpm knip`** was satisfied via step 7’s `pnpm lint` (or a separate `pnpm knip` if you ran it explicitly), whether **normalization** (step 7) completed with a **clean** working tree, the final **`stability_iterations`** count (0–3), and whether **`lint:report`**, **`test`**, **`coverage:report`**, **`build`**, **pack + `npx` smoke**, **`codeql`**, and **format + lint** passed.
