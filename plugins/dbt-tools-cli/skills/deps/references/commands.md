<!-- markdownlint-disable MD013 MD060 -->
# deps — command cheat sheet

## Baseline

```bash
dbt-tools deps model.my_project.orders --dbt-target ./target --json
```

- **Resource id** is the first **positional** argument: the dbt **`unique_id`**. Do not append query strings or URL fragments to the id.
- **Downstream** is the usual default for “what breaks if I change this?” **Upstream** is for “what feeds this node?”

## Direction and depth (stable patterns)

```bash
# Upstream (dependencies of this node)
dbt-tools deps model.my_project.orders --dbt-target ./target --direction upstream --json

# Downstream (dependents) — often default; pass explicitly if your CLI default is uncertain
dbt-tools deps model.my_project.orders --dbt-target ./target --direction downstream --json

# Depth 1: immediate neighbors only (typical for “direct”)
dbt-tools deps model.my_project.orders --dbt-target ./target --depth 1 --json
```

## Format: tree vs flat

```bash
# Tree (nested) — good for human explanation when default
dbt-tools deps model.my_project.orders --dbt-target ./target --json

# Flat list — good for simple sets and smaller context
dbt-tools deps model.my_project.orders --dbt-target ./target --format flat --json
```

## Build-order style (upstream)

When you care about **topological** order of upstream nodes (e.g. “in what order are these built?”), use the **build-order** flag for **upstream** (check availability):

```bash
dbt-tools deps model.my_project.orders --dbt-target ./target --direction upstream --build-order --json
```

## Bounding output

- **`--fields`**: include only the columns you need (often `unique_id`, `name`, `resource_type`) to keep the agent context small.
- **Depth**: cap hops before asking for the full graph on large projects.

## Common failure modes

| Symptom                                     | Likely cause                                   | What to do                                            |
| ------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `VALIDATION_ERROR` on resource id           | Malformed id, embedded `?`/`#`, or typos       | Use `search` / `discover` to copy a real `unique_id`. |
| `ARTIFACT_BUNDLE_INCOMPLETE` / parse errors | Bad `--dbt-target` or missing `manifest.json`  | Fix target; ensure manifest exists.                   |
| Empty or unexpected graph                   | Wrong direction or depth, or id not in project | Re-check id and project; try `--depth 1` first.       |
| Option not recognized                       | CLI version drift                              | `dbt-tools schema deps` and `dbt-tools deps --help`.  |

## Introspect before scripting

```bash
dbt-tools schema deps
dbt-tools deps --help
```
