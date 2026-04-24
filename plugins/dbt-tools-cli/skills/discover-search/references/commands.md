# Discover & Search Commands Reference

## Basic Discovery

Discover resources based on a free-text query or approximate name. This is often the best first step to resolve a `unique_id`.

```bash
dbt-tools discover --dbt-target ./target "customer orders" --json
```

_(Note: If `discover` is unavailable, use `search` or check `dbt-tools schema`)_

## Search by Exact or Partial Matches

Use `search` when you have a specific string to match against names or tags:

```bash
dbt-tools search --dbt-target ./target "orders" --json
```

## Bounding Large Output

When searching broadly, use `--limit` and `--fields` to keep the context window small:

```bash
dbt-tools search --dbt-target ./target "orders" --limit 5 --fields "unique_id,name,resource_type" --json
```

## Common Failure Responses

- **Ambiguous or zero results**: The query did not match any resources, or matched too many to be useful without further filtering. Try adjusting the query, using more specific terms, or removing filters.
- **Missing artifact target / files**: Verify the `--dbt-target` is correct and contains the necessary artifact JSON files.
- **Unsupported or changed command options**: The command line options may change over time. If a flag fails, verify the current schema using `dbt-tools schema search` or `dbt-tools schema discover`.
