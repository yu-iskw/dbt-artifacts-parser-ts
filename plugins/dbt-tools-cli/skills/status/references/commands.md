# status command cheat sheet

Use this page for stable, agent-friendly readiness checks.

## Core recipe

```bash
dbt-tools status --dbt-target ./target --json
```

- Use `--json` when you need machine-readable stdout and structured stderr.
- Reuse the same `--dbt-target` for follow-up commands.

## Freshness-oriented check

```bash
dbt-tools freshness --dbt-target ./target --json
```

If `freshness` behavior is unclear in your installed version, inspect:

```bash
dbt-tools schema
dbt-tools freshness --help
```

## Output-bounding guidance

`status` is usually small already. If your CLI version supports field filtering, prefer a small subset (for example readiness + file metadata) to keep agent context compact.

When uncertain about supported filters/options, use:

```bash
dbt-tools schema
dbt-tools status --help
```

## Common failure responses

- **Missing artifact target:** confirm or request `--dbt-target`, or ensure `DBT_TOOLS_DBT_TARGET` is set.
- **Missing required artifact files:** report missing `manifest.json` and/or `run_results.json`; ask user to regenerate artifacts and retry.
- **Unsupported or changed command options:** stop assuming flags; inspect `dbt-tools schema` or `dbt-tools status --help`.
