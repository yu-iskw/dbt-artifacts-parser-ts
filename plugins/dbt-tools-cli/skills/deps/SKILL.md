---
name: deps
description: Investigate upstream and downstream dependencies for a dbt resource using dbt-tools deps. Use when the user asks what a model depends on, what depends on it, or wants a build-order view of the dependency graph.
compatibility: dbt-tools CLI (dbt-artifacts-parser-ts); usable by any coding agent or IDE agent (Cursor, Windsurf, Claude).
---

# dbt dependency investigation

## When to use

Use this skill when the user asks:

- What does model `orders` depend on (upstream)?
- What models will break if I change `customers` (downstream)?
- Show me the immediate parents / children only.
- What is the build order for this model's upstream chain?
- Export a flat list of all downstream nodes.

You need a `unique_id` to run `deps`. If you only have a name, use `dbt-tools discover` or `dbt-tools search` first to resolve it (see the `discover-search` skill).

## Commands

Requires `manifest.json` under `--dbt-target`.

### Downstream (default)

```bash
dbt-tools deps model.my_project.customers --dbt-target ./target --json
```

### Upstream

```bash
dbt-tools deps model.my_project.customers --dbt-target ./target --direction upstream --json
```

### Depth-limited (immediate neighbors only)

```bash
# Direct children
dbt-tools deps model.my_project.customers --dbt-target ./target --depth 1 --json

# Direct parents
dbt-tools deps model.my_project.customers --dbt-target ./target --direction upstream --depth 1 --json
```

Omit `--depth` for full traversal.

### Flat list vs tree

Default output is a tree. Use `--format flat` when you need a simple list of `unique_id` values, for example to pipe into another command or display a count:

```bash
dbt-tools deps model.my_project.customers --dbt-target ./target --format flat --json
```

### Build order (topological sort)

Use `--build-order` with `--direction upstream` to get the correct execution sequence for rebuilding this node:

```bash
dbt-tools deps model.my_project.customers --dbt-target ./target \
  --direction upstream --build-order --json
```

### Reduce context window size

Use `--fields` to return only the fields you need:

```bash
dbt-tools deps model.my_project.customers --dbt-target ./target \
  --fields "unique_id,name" --json
```

### Combining patterns

```bash
# Top-level upstream neighbors, minimal fields
dbt-tools deps model.my_project.customers --dbt-target ./target \
  --direction upstream --depth 1 --fields "unique_id,name" --json

# Full downstream flat list for impact triage
dbt-tools deps model.my_project.customers --dbt-target ./target \
  --format flat --json
```

## Workflow with discover

If you do not have the `unique_id` yet:

```bash
# 1. Resolve the id
dbt-tools discover --dbt-target ./target "customers" --json
# → note unique_id, e.g. "model.my_project.customers"

# 2. Query deps
dbt-tools deps model.my_project.customers --dbt-target ./target --json
```

## Related

- Full CLI reference: [packages/dbt-tools/cli/README.md](../../../../packages/dbt-tools/cli/README.md) — `deps`, `graph`, `inventory` sections, Field Filtering, Automation and agent workflows.
- Discovery: `discover-search` skill for resolving `unique_id` values.
- Explain and impact: `explain-impact` skill for per-resource explanation and downstream impact reasoning.
