---
name: status
description: >-
  Check dbt artifact presence, recency, and analysis readiness with `dbt-tools status` (or `freshness`); interpret `readiness` and file stats when the user asks if artifacts exist, are stale, or are ready. Optional—not a required preflight for other investigation flows.
compatibility: dbt-tools CLI (global `dbt-tools` on PATH). Reads `--dbt-target` or `DBT_TOOLS_DBT_TARGET`; `status` is filesystem- or download-scoped, not a substitute for dbt build orchestration. Works with any terminal agent or SKILL.md consumer.
---

# dbt artifact status and freshness

## Trigger scenarios

- The user asks whether **artifacts exist**, are **stale**, or are **ready** for dbt artifact analysis.
- You need a **ground-truth snapshot** of what is under a dbt target (paths, `exists`, ages) before *choosing* whether to run heavier commands.
- A prior command failed with **missing file** or **incomplete bundle**—use `status` to align on what is actually on disk (or in a remote prefix).

## Purpose

Use **`dbt-tools status`** (or the **`freshness`** alias) to report whether **`manifest.json`** and **`run_results.json`** are present, their paths, modification times, and a **readiness** label. This is the primary CLI surface for **artifact readiness** and **rough freshness** (file mtimes), without parsing full artifact JSON (local case).

**Do not** treat this skill as a **mandatory gate** before every `deps`, `search`, or `explain` run. If the user already provided a valid **`--dbt-target`**, use it and proceed; call **`status`** when readiness or staleness is the *question*.

## Inputs the agent should identify

- **Artifact root**: `--dbt-target` path, or `DBT_TOOLS_DBT_TARGET`, or a remote **`s3://` / `gs://`** prefix when applicable.
- **What “ready” means for the next step**: full graph+run analysis needs both core files; some workflows tolerate **manifest-only** (see [references/commands.md](references/commands.md)).
- **Machine-readable output need**: use **`--json`** when the agent must parse stdout (and structured error JSON on stderr for modeled failures).

## Recommended command pattern

1. **Default (explicit JSON for agents in interactive TTYs):**

   `dbt-tools status --dbt-target <path-or-uri> --json`

2. **Omit the flag in CI** when the environment already sets `DBT_TOOLS_DBT_TARGET`.

3. For **readability only** in a human session, you may drop `--json`; for **automation**, always pass `--json` so output and error shapes are consistent.

Cheat sheet and readiness matrix: [references/commands.md](references/commands.md). Full CLI context (remote behavior, error codes) stays in the package README—do not copy exhaustive option lists here.

## How to interpret results

- Read **`readiness`**: `full` → both `manifest.json` and `run_results.json` present; `manifest-only` → manifest only; `unavailable` → no manifest.
- Use **`manifest.exists` / `run_results.exists`**, **paths**, **`modified_at` / `age_seconds`**, and **`summary`** to answer “exists / how old / can we analyze execution?”
- For **local** paths, `status` reflects **directory** contents; for **remote** targets the CLI fetches the same fixed keys, then reports stats (see CLI README if you need remote details).

## Failure handling

- **Missing or invalid target**: error text or (with **`--json`**) structured stderr—pass through to the user; suggest fixing path, env, or remote credentials.
- **`unavailable` readiness**: do not run manifest-based analysis until **`manifest.json`** is produced (e.g. a dbt parse/compile that writes artifacts).
- After **upstream failures** in other commands (missing artifact file), re-run **`status --json`** with the **same** root to reconcile what is missing.

**Uncertain about flags?** `dbt-tools schema status` or `dbt-tools status --help` (current CLI).

## Verification / completion criteria

- The user’s question about **existence, freshness, or readiness** is answered from parsed **`status` output** (or a clear error).
- The agent has recorded **`readiness`**, the **checked paths** (`target_dir` / manifest / run_results paths in JSON), and whether **run-scoped** commands (e.g. `timeline`, `run-report` style flows) are appropriate.
- The agent has **not** implied that **`status` must** run before unrelated commands when the user already provided a valid artifact root.

## Related (optional)

Other plugin skills under the same `skills/` root cover discovery, dependencies, and explain/impact. They do not require this skill to have been run first.
