---
name: deps
description: Investigate upstream and downstream dependencies for a dbt resource. Use when analyzing lineage, identifying root causes, or determining the impact of a model change.
compatibility: Requires dbt-tools CLI installed and available on PATH.
---

# Dependencies (deps)

## Trigger scenarios

Activate this skill when:

- The user asks what models depend on a specific model (downstream impact).
- The user asks what sources or models are required to build a specific model (upstream lineage).
- You need to investigate lineage for a known resource id.

## Purpose

Help an agent investigate upstream and downstream dependencies for a dbt resource using `dbt-tools deps`.

## Inputs the agent should identify

- `<resource-id>`: The exact `unique_id` of the resource to investigate.
- `--dbt-target`: The dbt artifacts location (trust user input or environment variable).

## Recommended command pattern

Get all dependencies (upstream and downstream) in JSON format:

```bash
dbt-tools deps --dbt-target <target> <resource-id> --json
```

Focus on upstream or downstream specifically, and limit fields to reduce context size:

```bash
dbt-tools deps --dbt-target <target> <resource-id> --direction upstream --fields "unique_id,resource_type" --json
```

## How to interpret results

The JSON output will typically include lists or trees of upstream and downstream nodes. This information represents the build-order dependencies or the lineage graph relative to the target resource.

## Failure handling

See [commands.md](./references/commands.md) for handling invalid resource IDs or missing artifacts.

## Verification / completion criteria

The skill is complete when you have successfully retrieved the required dependency information (upstream or downstream) for the requested resource and can answer the user's questions about its lineage.
