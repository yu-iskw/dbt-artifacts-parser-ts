---
name: status
description: Check dbt artifact readiness and freshness under a target path so an agent can decide whether analysis commands are likely to work.
compatibility: dbt-tools CLI on PATH; local or remote --dbt-target supported.
---

# status

## Trigger scenarios

Activate this skill when the user asks whether dbt artifacts:

- exist at a target directory or prefix,
- are complete enough for analysis, or
- look stale based on file timestamps.

## Purpose

Use `dbt-tools status` (or `freshness`) to quickly classify artifact availability and recency without assuming deeper command success.

This skill is useful as a targeted check, but it is **not** a mandatory preflight before every other skill.

## Inputs the agent should identify

- Target location (`--dbt-target`), if provided by the user.
- Whether machine-readable output is needed (`--json` preferred for parsing).
- Whether the user cares about readiness, freshness, or both.

## Recommended command pattern

Prefer JSON for agent parsing:

```bash
dbt-tools status --dbt-target <target> --json
```

If `--dbt-target` is omitted intentionally, rely on `DBT_TOOLS_DBT_TARGET` if set.

For lightweight command recipes and failure branches, see [references/commands.md](references/commands.md).

## How to interpret results

- Extract readiness classification and required-file presence first.
- Report exactly which required files were found or missing.
- If freshness fields are present, summarize age and whether it matches user expectations.
- Use the result to decide whether to proceed, request artifact generation, or switch to a different target.

## Failure handling

- Missing target or missing required files: explain what is absent and suggest producing artifacts (for example by running dbt and pointing to the correct target).
- Invalid path or inaccessible remote prefix: surface the CLI error, then retry only after correcting the target.
- Option mismatch: check `dbt-tools schema` or `dbt-tools status --help` before guessing flags.

## Verification / completion criteria

Consider this skill complete when the agent has:

1. Run `status` (preferably with `--json` when parsing is needed).
2. Reported readiness and file presence clearly.
3. Stated whether analysis can proceed for the user’s goal.
4. Provided a concrete next step when artifacts are incomplete or stale.
