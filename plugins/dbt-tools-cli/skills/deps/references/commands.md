# deps command cheat sheet

Use these stable patterns for lineage investigation from a known `unique_id`.

## Baseline JSON query

```bash
dbt-tools deps model.my_project.orders --dbt-target ./target --json
```

## Direction patterns

```bash
dbt-tools deps model.my_project.orders --dbt-target ./target --direction upstream --json

dbt-tools deps model.my_project.orders --dbt-target ./target --direction downstream --json
```

## Depth-limited traversal

```bash
dbt-tools deps model.my_project.orders --dbt-target ./target --depth 1 --json
```

Use shallow depth first for quick context, then widen only if needed.

## Output shape patterns

```bash
dbt-tools deps model.my_project.orders --dbt-target ./target --format flat --json

dbt-tools deps model.my_project.orders --dbt-target ./target --format tree --json

dbt-tools deps model.my_project.orders --dbt-target ./target --direction upstream --build-order --json
```

If certain options are unavailable in your CLI version, inspect:

```bash
dbt-tools schema
dbt-tools deps --help
```

## Output-bounding guidance

When supported, use small field sets (`--fields`) or pagination-like options to keep agent context manageable.

## Common failure responses

- **Missing artifact target:** confirm `--dbt-target` or `DBT_TOOLS_DBT_TARGET`.
- **Missing required artifact files:** deps needs manifest-backed artifacts; ask user to regenerate or point at the right target.
- **Invalid resource id:** run discovery/search to recover a valid `unique_id`.
- **Unsupported or changed command options:** stop assuming syntax; use `dbt-tools schema` / `dbt-tools deps --help`.
