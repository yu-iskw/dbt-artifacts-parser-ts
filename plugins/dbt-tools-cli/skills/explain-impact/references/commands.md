# Explain & Impact Commands Reference

## Basic Usage

Because the exact options for `explain` and `impact` may evolve, it is a best practice to check their schema if you encounter errors:

```bash
dbt-tools schema explain
dbt-tools schema impact
```

Alternatively, use the built-in help:

```bash
dbt-tools explain --help
dbt-tools impact --help
```

## Explain a Resource

Get detailed information about a resource (definition, description, compiled code):

```bash
dbt-tools explain --dbt-target ./target model.my_project.my_model --json
```

## Assess Impact

Get a summary of the downstream impact of a resource:

```bash
dbt-tools impact --dbt-target ./target model.my_project.my_model --json
```

## Common Failure Responses

- **Command not found / Unsupported command**: The `explain` or `impact` command might not be available in the currently installed version of `dbt-tools`. Rely on `dbt-tools deps` or investigate the raw manifest files if these specific commands are absent.
- **Invalid resource id**: The provided `<resource-id>` does not exist. Verify the exact `unique_id` (perhaps using `discover-search`).
- **Missing artifact target / files**: Verify the `--dbt-target` path and ensure required artifact files exist.
