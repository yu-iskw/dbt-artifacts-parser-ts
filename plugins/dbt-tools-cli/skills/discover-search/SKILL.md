---
name: discover-search
description: Find dbt resources by name, type, tag, package, path, or approximate user wording using dbt-tools discover or search. Use when you need to resolve a candidate unique_id for a resource to use in subsequent commands.
compatibility: Requires dbt-tools CLI installed and available on PATH.
---

# Discover / Search

## Trigger scenarios

Activate this skill when:

- You need to find a specific dbt resource but only know its approximate name, tag, or path.
- The user asks about a resource, and you need to determine its exact `unique_id` before running other commands (like `deps` or `explain`).
- You need to list resources matching specific criteria (e.g., all models with a certain tag).

## Purpose

Help an agent find dbt resources by various criteria to resolve exact `unique_id` values for later commands. This skill uses `dbt-tools discover` and `dbt-tools search`. It emphasizes resolving `unique_id` values but remains usable on its own.

## Inputs the agent should identify

- Search query or filtering criteria (e.g., resource name, tags, resource type).
- `--dbt-target`: The dbt artifacts location (trust user input or environment variable).

## Recommended command pattern

For general discovery and search (with JSON output for easy parsing):

```bash
dbt-tools discover --dbt-target <target> "<query>" --json
```

Or using `search`:

```bash
dbt-tools search --dbt-target <target> "<query>" --json
```

Use field filtering to limit output context when expecting many results:

```bash
dbt-tools search --dbt-target <target> "<query>" --fields "unique_id,name,resource_type" --json
```

## How to interpret results

The JSON output will list matching resources. Look for the `unique_id` field in the results, as this is the canonical identifier needed for commands like `deps`. `discover` may also provide scores or reasons for matches.

## Failure handling

See [commands.md](./references/commands.md) for handling ambiguous results or missing artifacts.

## Verification / completion criteria

The skill is complete when you have successfully identified the target resources and their `unique_id` values, or when you have confirmed that no such resources exist.
