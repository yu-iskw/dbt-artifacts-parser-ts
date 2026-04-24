# Status Commands Reference

## Basic Usage

Check the status of dbt artifacts at a given target:

```bash
dbt-tools status --dbt-target ./target
```

## JSON Output (Agent Preferred)

Request JSON output to easily parse the status information:

```bash
dbt-tools status --dbt-target ./target --json
```

## Common Failure Responses

- **Missing artifact target**: The `--dbt-target` option is missing and the `DBT_TOOLS_DBT_TARGET` environment variable is not set. Ensure the target is provided.
- **Missing required artifact files**: The target directory or prefix does not contain the required `manifest.json` and `run_results.json` files. Verify the target path and ensure the dbt run was successful and generated these files.
- **Unsupported or changed command options**: The command options may have changed. Use `dbt-tools schema status` or `dbt-tools status --help` to inspect the available options dynamically.
