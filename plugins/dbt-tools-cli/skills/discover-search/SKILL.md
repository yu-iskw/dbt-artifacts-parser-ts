---
name: discover-search
description: Find dbt resources by name, type, tag, package, path, or approximate user wording using dbt-tools discover and dbt-tools search. Use to resolve candidate unique_id values before running deps, explain, or impact.
compatibility: dbt-tools CLI (dbt-artifacts-parser-ts); usable by any coding agent or IDE agent (Cursor, Windsurf, Claude).
---

# dbt resource discovery and search

## When to use

Use this skill when the user asks:

- Find a dbt model / source / test by name or approximate spelling.
- Which resources have tag `finance` or belong to package `core`?
- What is the `unique_id` for "orders" so I can query its dependencies?
- Show me all staging models under `models/staging/`.

After getting results, use the `unique_id` values for follow-up commands (`deps`, `explain`, `impact`, `inventory`).

## Commands

### `discover` — ranked, explainable results (preferred for agents)

`discover` returns scored matches with `confidence`, `reasons`, `related` neighbors, `next_actions`, and `primitive_commands`. Prefer it when you need machine-readable scores or suggested next steps.

```bash
# Fuzzy / free-text
dbt-tools discover --dbt-target ./target "orders" --json

# Type filter
dbt-tools discover --dbt-target ./target "type:model orders" --json

# Tag filter
dbt-tools discover --dbt-target ./target "tag:finance" --json

# Package filter
dbt-tools discover --dbt-target ./target "package:core" --json

# Filter only, no text query
dbt-tools discover --dbt-target ./target --type model --json

# Page results to keep context small
dbt-tools discover --dbt-target ./target "orders" --limit 10 --offset 0 --json
```

Inline query tokens: `type:<value>`, `package:<value>`, `tag:<value>`, `owner:<value>`, `source:<value>`. Flag-based filters (`--type`, `--tag`, `--package`, `--path`) override inline tokens.

Requires only `manifest.json` under `--dbt-target`.

### `search` — fast substring / token search (simpler alternative)

Use `search` when you need a quick substring match without scoring metadata.

```bash
dbt-tools search --dbt-target ./target orders --json

# Inline tokens
dbt-tools search --dbt-target ./target "type:model orders" --json
dbt-tools search --dbt-target ./target "tag:finance" --json

# Flag-based
dbt-tools search --dbt-target ./target --type model --tag finance --json

# Page
dbt-tools search --dbt-target ./target orders --limit 10 --offset 0 --json
```

### Resolve `unique_id` from results

Both commands return `unique_id` in each result element. Extract it for downstream use:

```bash
# discover
dbt-tools discover --dbt-target ./target "orders" --json \
  | jq '.matches[0].unique_id'

# search
dbt-tools search --dbt-target ./target orders --json \
  | jq '.results[0].unique_id'
```

When multiple candidates are returned, show the list to the user and ask them to confirm before proceeding.

### Reduce context window size

Use `--limit` to cap results and `--fields` to return only the fields you need:

```bash
dbt-tools discover --dbt-target ./target "orders" --limit 5 --fields "matches" --json
dbt-tools search --dbt-target ./target orders --limit 10 --fields "results" --json
```

### Disambiguation

`discover` includes a `disambiguation` array when confidence is low. Present those alternatives to the user before acting on a single result.

### Tracing (debug / audit)

Pass `--trace` to add `investigation_transcript` to the JSON response, useful when you need to explain the scoring steps to the user.

```bash
dbt-tools discover --dbt-target ./target "ordrs" --trace --json
```

## Related

- Full CLI reference: [packages/dbt-tools/cli/README.md](../../../../packages/dbt-tools/cli/README.md) — `discover`, `search`, `inventory` sections, Field Filtering, Automation and agent workflows.
- Follow-up skills: `deps` (dependency traversal), `explain-impact` (explain and impact analysis).
