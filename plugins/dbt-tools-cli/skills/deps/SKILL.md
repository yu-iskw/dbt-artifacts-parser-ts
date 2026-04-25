---
name: deps
description: Investigate upstream/downstream dependencies for a known dbt resource id, including depth-limited, flat/tree, and build-order views.
compatibility: dbt-tools CLI on PATH; requires a valid resource unique_id in the target manifest.
---

# deps

## Trigger scenarios

Activate this skill when the user asks:

- what depends on a resource,
- what a resource depends on,
- how far dependency impact propagates,
- what build order to follow upstream.

## Purpose

Use `dbt-tools deps` to traverse lineage from a known `unique_id` and summarize dependency shape for planning, debugging, and impact review.

## Inputs the agent should identify

- Resource `unique_id` (or first resolve it via discovery/search).
- Target direction (`upstream` or `downstream`).
- Desired depth (immediate neighbors vs wider graph).
- Output style needed by the user (`flat`, `tree`, build-order style where supported).
- Need for machine-readable output (`--json`).

## Recommended command pattern

Default to parse-friendly output:

```bash
dbt-tools deps <unique_id> --dbt-target <target> --json
```

Adjust direction/depth/shape at a high level to match the question. Use bounded output (`--limit`/`--fields` when available) if results are large.

For stable command recipes, see [references/commands.md](references/commands.md).

## How to interpret results

- Confirm the root node matches the requested resource.
- Separate immediate neighbors from deeper dependencies when depth > 1.
- Highlight critical downstream blast radius or key upstream prerequisites.
- When build-order output is available, use it as execution guidance rather than as full scheduling truth.

## Failure handling

- Invalid resource id: re-run discovery/search and retry with a confirmed `unique_id`.
- Missing target artifacts: request/correct `--dbt-target` and ensure manifest exists.
- Excessively large graph: reduce depth or fields, or switch to a flat summary.
- Option mismatch: check `dbt-tools schema` or `dbt-tools deps --help`.

## Verification / completion criteria

Consider this skill complete when the agent has:

1. Run `deps` with the requested direction and reasonable depth.
2. Returned dependency results in the user’s preferred shape (flat/tree/build-order where available).
3. Summarized key upstream/downstream findings clearly.
4. Identified next analysis steps (for example `impact` or focused explanation on critical nodes).
