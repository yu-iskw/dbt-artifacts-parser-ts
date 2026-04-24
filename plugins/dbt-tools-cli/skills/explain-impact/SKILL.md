---
name: explain-impact
description: Explain a selected resource and reason about its impact. Use when you need to understand what a model does, its definition, or its overall downstream impact.
compatibility: Requires dbt-tools CLI installed and available on PATH.
---

# Explain / Impact

## Trigger scenarios

Activate this skill when:

- The user asks you to explain what a specific model or resource does.
- You need to review the configuration, description, or compiled SQL of a resource.
- The user asks about the overall impact of changing a specific model.

## Purpose

Help an agent explain a selected resource and reason about its impact using `dbt-tools explain` and `dbt-tools impact` (if available).

## Inputs the agent should identify

- `<resource-id>`: The exact `unique_id` of the resource.
- `--dbt-target`: The dbt artifacts location (trust user input or environment variable).

## Recommended command pattern

Since the availability of `explain` and `impact` commands may vary based on the CLI version, it is highly recommended to first verify their existence and schema using `dbt-tools schema`:

```bash
dbt-tools schema explain --json
dbt-tools schema impact --json
```

If `explain` is available, use it to get details about the resource:

```bash
dbt-tools explain --dbt-target <target> <resource-id> --json
```

If `impact` is available, use it to assess downstream effects:

```bash
dbt-tools impact --dbt-target <target> <resource-id> --json
```

## How to interpret results

The JSON output of `explain` should provide configuration, descriptive text, and possibly compiled code for the resource.
The JSON output of `impact` should provide a summary of downstream models, tests, or exposures that might be affected by changes to the target resource.

## Failure handling

See [commands.md](./references/commands.md) for handling missing commands or invalid resource IDs.

## Verification / completion criteria

The skill is complete when you have successfully retrieved the explanation or impact assessment for the requested resource and can provide the user with the requested context.
