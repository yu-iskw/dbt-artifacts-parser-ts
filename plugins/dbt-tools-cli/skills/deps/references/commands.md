# Dependencies Commands Reference

## Basic Usage

Get all dependencies (both upstream and downstream) for a known resource id:

```bash
dbt-tools deps --dbt-target ./target model.my_project.my_model --json
```

## Directional Focus

Restrict the analysis to just upstream or downstream dependencies. This is highly recommended to keep the output manageable.

**Upstream only (what builds this?):**

```bash
dbt-tools deps --dbt-target ./target model.my_project.my_model --direction upstream --json
```

**Downstream only (what depends on this?):**

```bash
dbt-tools deps --dbt-target ./target model.my_project.my_model --direction downstream --json
```

## Bounding Output and Depth

Use `--fields` to limit the data returned for each node. Use `--depth` (if supported by the CLI version) to limit the traversal distance from the target node.

```bash
dbt-tools deps --dbt-target ./target model.my_project.my_model --direction downstream --fields "unique_id,resource_type" --json
```

## Common Failure Responses

- **Invalid resource id**: The provided `<resource-id>` does not exist in the manifest. Ensure you are using the exact `unique_id` (e.g., `model.package_name.model_name`). If unsure, use the `discover-search` skill first.
- **Missing artifact target / files**: Verify the `--dbt-target` is correct and contains the required artifact JSON files.
- **Unsupported or changed command options**: The CLI surface may change. If an option fails, check the current schema using `dbt-tools schema deps` or `dbt-tools deps --help`.
