---
name: dbt-artifacts-status
description: Check local dbt artifact readiness with dbt-tools status before running manifest- or run_results-based analysis; interpret readiness and branch.
---

# dbt artifacts status (readiness gate)

## When to use

Use this workflow whenever you are about to run **`@dbt-tools/cli`** commands that read **`manifest.json`**, **`run_results.json`**, or both—unless the user has already confirmed those artifacts exist at known paths.

Run the gate **before** `deps`, `inventory`, `search`, `summary`, `graph`, `timeline`, `run-report`, or similar analysis. Use it when working in a new workspace, CI, or after errors like missing files.

## Commands

Prefer **explicit JSON** so behavior does not depend on TTY detection:

```bash
dbt-tools status --json
```

Custom target directory (artifacts live under that directory by default):

```bash
dbt-tools status --target-dir ./custom-target --json
```

Same semantics via environment variable (see package README for precedence):

```bash
DBT_TOOLS_TARGET_DIR=./custom-target dbt-tools status --json
```

## Interpret `readiness`

Parse the JSON object printed to stdout. The important field is **`readiness`**:

| Value           | Meaning                                                    |
| --------------- | ---------------------------------------------------------- |
| `full`          | `manifest.json` and `run_results.json` are both present.   |
| `manifest-only` | `manifest.json` is present; `run_results.json` is missing. |
| `unavailable`   | `manifest.json` is missing.                                |

Also read **`manifest.path`**, **`run_results.path`**, and **`target_dir`** when reporting what is missing or which directory was checked.

Full command availability by readiness: [references/readiness.md](references/readiness.md).

## Branching rules

- If **`readiness` is `unavailable`**: do not run manifest-based analysis. Stop and tell the user **`manifest.path`** was not found (or run `dbt` to produce artifacts). Only `status` / `freshness` is meaningful until a manifest exists.
- If **`readiness` is `manifest-only`**: you may run commands that need only the manifest. Do **not** run **`timeline`** or **`run-report`** (they require `run_results.json`). See the matrix in [references/readiness.md](references/readiness.md).
- If **`readiness` is `full`**: manifest and run-result based commands are allowed, subject to normal CLI validation and parsing errors.

**Caveat:** `status` checks the **local filesystem** only. It does not validate remote artifact sources (for example S3 or GCS).

## Sub-agent contract

When delegating to a sub-agent whose job is **only** readiness:

1. Run `dbt-tools status --json` (with `--target-dir` or `DBT_TOOLS_TARGET_DIR` if applicable).
2. Return the **parsed JSON** (or the raw stdout line) to the parent. The parent should pass at least **`readiness`**, **`target_dir`**, **`manifest.path`**, and **`run_results.path`** into downstream steps.

Downstream sub-agents (search, deps, run forensics) should assume this contract and **not** re-guess artifact locations.

## Related documentation

- Full CLI reference and options: [packages/dbt-tools/cli/README.md](../../../../packages/dbt-tools/cli/README.md) (`status` / `freshness` section).
- Agents and errors: [docs/user-guide-dbt-tools-cli.md](../../../../docs/user-guide-dbt-tools-cli.md).
