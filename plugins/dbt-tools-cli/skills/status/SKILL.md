---
name: status
description: Check dbt artifact readiness, file freshness, and whether manifest.json / run_results.json are present under a dbt target using dbt-tools status. Use when the user asks whether artifacts exist, are stale, or are ready for analysis.
compatibility: dbt-tools CLI (dbt-artifacts-parser-ts); usable by any coding agent or IDE agent (Cursor, Windsurf, Claude).
---

# dbt artifact status

## When to use

Use this skill when the user asks:

- Are dbt artifacts available / up to date?
- When was the last dbt run?
- Is `manifest.json` or `run_results.json` present at a given path?
- Should I run `dbt` before proceeding?

This skill is **not** mandatory preflight for other skills; skip it when the user has already confirmed artifacts exist or when `--dbt-target` is trusted.

## Commands

### Basic readiness check

```bash
dbt-tools status --dbt-target ./target --json
```

When **`DBT_TOOLS_DBT_TARGET`** is set you may omit the flag:

```bash
dbt-tools status --json
```

`freshness` is an alias for `status`.

### Interpret the response

Parse the JSON object on stdout. Key fields:

| Field | Purpose |
|---|---|
| `readiness` | `"full"`, `"manifest-only"`, or `"unavailable"` |
| `manifest.path` | Resolved path of `manifest.json` |
| `manifest.exists` | Whether the file was found |
| `manifest.age_seconds` | Seconds since last modification |
| `run_results.path` | Resolved path of `run_results.json` |
| `run_results.age_seconds` | Seconds since last modification |
| `target_dir` | Resolved artifact root (temp dir for remote targets) |

### Readiness values

| `readiness` | Meaning |
|---|---|
| `full` | Both `manifest.json` and `run_results.json` are present |
| `manifest-only` | `manifest.json` present; `run_results.json` missing |
| `unavailable` | `manifest.json` not found; most commands will fail |

Commands that require only `manifest.json` (`deps`, `inventory`, `search`, `discover`, `summary`, `graph`) work under `manifest-only`. Commands that need `run_results.json` (`timeline`, `run-report`, `failures`) require `full`. Run `dbt` to produce missing artifacts.

### Staleness heuristic

Use `age_seconds` to judge freshness. If the artifact is older than expected (for example more than a few hours in a daily CI environment), tell the user and ask whether to proceed or re-run `dbt`.

### Remote targets

For `s3://` or `gs://` targets the CLI downloads the artifact bundle first, then reports stats on the downloaded copies. Pass the same `--dbt-target` value you plan to use for analysis commands.

## Related

- Full CLI reference: [packages/dbt-tools/cli/README.md](../../../../packages/dbt-tools/cli/README.md) — `status / freshness` section, Error handling, Environment variables.
- Readiness-to-command matrix: [dbt-artifacts-status skill](../dbt-artifacts-status/SKILL.md) (more detailed branching rules and sub-agent contract).
