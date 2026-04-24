---
name: status
description: Check dbt artifact readiness, freshness, and whether required files are present under a dbt target. Use when the user asks whether artifacts exist, are stale, or are ready for analysis.
compatibility: Requires dbt-tools CLI installed and available on PATH.
---

# Status

## Trigger scenarios

Activate this skill when:

- The user asks if the dbt artifacts are ready for analysis.
- The user asks if the artifacts are stale.
- The user asks to check the freshness of the artifacts.
- You need to verify if the required artifact files are present at a given target.

## Purpose

Help an agent check dbt artifact readiness, freshness, and whether required files are present under a dbt target using `dbt-tools status`.

## Inputs the agent should identify

- `--dbt-target`: The path or object storage URI (e.g. `s3://...` or `gs://...`) where the dbt artifacts are located. Trust the user-provided `--dbt-target` when present. If not provided, it may be set in the `DBT_TOOLS_DBT_TARGET` environment variable.

## Recommended command pattern

```bash
dbt-tools status --dbt-target <target> --json
```

Use `--json` to get machine-readable stdout and structured stderr, making it easier to parse the results.

## How to interpret results

The JSON output will contain information about the presence of required artifacts (`manifest.json` and `run_results.json`), optional artifacts (`catalog.json` and `sources.json`), and the freshness of the artifacts (e.g., `latest_modified_at`, `age_seconds`).

## Failure handling

See [commands.md](./references/commands.md) for common failure responses and how to handle them.

## Verification / completion criteria

The skill is complete when you have successfully retrieved the status of the dbt artifacts and can answer the user's question regarding their readiness, freshness, or presence.
