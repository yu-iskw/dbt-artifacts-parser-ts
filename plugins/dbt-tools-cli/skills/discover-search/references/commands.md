# discover/search command cheat sheet

Use these lightweight patterns to turn user wording into `unique_id` candidates.

## Start broad (JSON)

```bash
dbt-tools search "orders" --dbt-target ./target --json
```

or

```bash
dbt-tools discover --dbt-target ./target --json
```

Choose whichever command is available and better aligned to your installed CLI surface.

## Narrow result size

```bash
dbt-tools search "orders" --dbt-target ./target --json --limit 20
```

If supported, add `--fields` to keep only identifiers and key labels.

When options differ across versions, check:

```bash
dbt-tools schema
dbt-tools search --help
dbt-tools discover --help
```

## Typical workflow

1. Query by the user’s wording.
2. Apply type/tag/package/path filters if available.
3. Return top `unique_id` candidates.
4. Hand off selected id to `deps`, `explain`, or `impact`.

## Common failure responses

- **Missing artifact target:** set/confirm `--dbt-target` (or `DBT_TOOLS_DBT_TARGET`).
- **Missing required artifact files:** manifest is required for discovery; ask user to regenerate artifacts.
- **Ambiguous results:** provide a short candidate list and ask for selection.
- **Zero discovery results:** broaden query or remove strict filters; verify target is correct.
- **Unsupported or changed command options:** inspect `dbt-tools schema` or command-specific `--help`.
