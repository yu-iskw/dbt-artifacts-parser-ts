# explain/impact command cheat sheet

Use this page for stable investigation flow, not exhaustive CLI syntax.

## Check availability first when uncertain

```bash
dbt-tools schema
dbt-tools explain --help
dbt-tools impact --help
```

If `impact` is not available in your installed CLI, continue with `explain` plus `deps` for impact reasoning.

## Explain a selected resource

```bash
dbt-tools explain model.my_project.orders --dbt-target ./target --json
```

## Estimate or inspect impact

```bash
dbt-tools impact model.my_project.orders --dbt-target ./target --json
```

Prefer JSON for machine-readable stdout and structured stderr.

## Keep output bounded

When supported, use `--fields`, `--limit`, or similar controls to keep context small and focused on key nodes.

For version-specific option names, rely on `schema`/`--help` instead of assumptions.

## Common failure responses

- **Missing artifact target:** confirm `--dbt-target` (or `DBT_TOOLS_DBT_TARGET`).
- **Missing required artifact files:** request manifest/run artifacts before explanation/impact analysis.
- **Invalid resource id:** use discovery/search to get a valid `unique_id`.
- **Ambiguous or zero discovery results:** pause and disambiguate before running explain/impact.
- **Unsupported or changed command options:** inspect `dbt-tools schema` or `dbt-tools <command> --help` and retry with supported syntax.
