---
name: explain-impact
description: Explain a selected dbt resource and reason about its downstream impact using dbt-tools explain and dbt-tools impact. Use when the user wants to understand what a resource does or assess the blast radius of a change.
compatibility: dbt-tools CLI (dbt-artifacts-parser-ts); usable by any coding agent or IDE agent (Cursor, Windsurf, Claude).
---

# dbt explain and impact analysis

## When to use

Use this skill when the user asks:

- What does model `orders` do? Explain it.
- What is the blast radius if I change `customers`?
- Which downstream models will be affected by this change?
- Give me context on this resource before I modify it.

You need a `unique_id` to run these commands. If you only have a name, resolve it with `dbt-tools discover` or `dbt-tools search` first (see the `discover-search` skill).

## Commands

The `explain` and `impact` commands may be present depending on the installed CLI version. **Check availability before use:**

```bash
# List available commands
dbt-tools schema --json

# Check a specific command's options
dbt-tools explain --help
dbt-tools impact --help
```

If a command is not listed in `dbt-tools schema` output or returns an error, it is not available in the installed version. Fall back to `dbt-tools deps` and `dbt-tools discover` for investigation.

### `explain` — describe a resource

`explain` surfaces metadata, description, SQL context, and investigation hints for a single resource.

```bash
dbt-tools explain model.my_project.customers --dbt-target ./target --json
```

Use `--fields` to limit output when you only need specific fields:

```bash
dbt-tools explain model.my_project.customers --dbt-target ./target \
  --fields "unique_id,description" --json
```

Use `--trace` to include an `investigation_transcript` in the JSON for debugging or audit:

```bash
dbt-tools explain model.my_project.customers --dbt-target ./target --trace --json
```

### `impact` — assess downstream blast radius

`impact` reports which resources downstream of the given node would be affected by a change.

```bash
dbt-tools impact model.my_project.customers --dbt-target ./target --json
```

Use `--trace` for the investigation transcript:

```bash
dbt-tools impact model.my_project.customers --dbt-target ./target --trace --json
```

### Web links (optional)

When **`DBT_TOOLS_WEB_BASE_URL`** is set, JSON output from `explain` and `impact` includes `web_url` and `review_url` fields that open the resource in the dbt-tools web UI. These are informational; the investigation workflow does not require them.

## Investigation workflow

1. **Resolve `unique_id`** — use `dbt-tools discover` if you only have a name.
2. **Explain the resource** — `dbt-tools explain <unique_id> --dbt-target ... --json`
3. **Assess impact** — `dbt-tools impact <unique_id> --dbt-target ... --json`
4. **Drill into deps** — follow up with `dbt-tools deps` for depth-limited or build-order traversal if the impact output is large.
5. **Report to the user** — summarize description, affected downstream count, and any `next_actions` or `primitive_commands` returned in the JSON.

## Fallback when explain / impact are unavailable

```bash
# Explanation-equivalent: discover with trace
dbt-tools discover --dbt-target ./target "<name>" --trace --json

# Impact-equivalent: full downstream deps
dbt-tools deps <unique_id> --dbt-target ./target --direction downstream --format flat --json
```

## Related

- Full CLI reference: [packages/dbt-tools/cli/README.md](../../../../packages/dbt-tools/cli/README.md) — `discover`, `deps`, `schema` sections, Automation and agent workflows.
- Discovery: `discover-search` skill for resolving `unique_id` values.
- Dependency traversal: `deps` skill for upstream / downstream / build-order investigation.
