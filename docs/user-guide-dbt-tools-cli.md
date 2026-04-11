# User guide: @dbt-tools/cli

Extended notes for operators and automation using **`dbt-tools`**. The CLI is the **structured interface** to dbt artifact analysis: JSON-oriented defaults, `describe schema` for runtime discovery, and `--fields` to bound payloads. The vNext CLI uses a task-oriented hierarchy so humans and coding agents can discover commands through both help and machine-readable schema output. For the full command reference, see the [package README](../packages/dbt-tools/cli/README.md).

## Basics

- **Package:** `@dbt-tools/cli`
- **Binary:** `dbt-tools`
- **Node.js:** 20+
- **Default artifact location:** `./target`
- **Discovery:** `dbt-tools --help` plus `dbt-tools describe schema ...`

Install:

```bash
npm install -g @dbt-tools/cli
npx @dbt-tools/cli --help
```

## Command taxonomy

```text
dbt-tools inspect <summary|run|timeline|inventory>
dbt-tools find <resources>
dbt-tools trace <lineage>
dbt-tools export <graph>
dbt-tools check <artifacts>
dbt-tools describe <schema>
```

Recommended mental model:

- `inspect` = structured views over artifacts
- `find` = locate likely matches
- `trace` = traverse lineage
- `export` = emit graph/materialized output
- `check` = operational readiness
- `describe` = discovery and introspection

## Migration from the flat CLI

This release removes the older flat verbs. Update automation and scripts as follows:

| Before                 | After                         |
| :--------------------- | :---------------------------- |
| `dbt-tools summary`    | `dbt-tools inspect summary`   |
| `dbt-tools run-report` | `dbt-tools inspect run`       |
| `dbt-tools timeline`   | `dbt-tools inspect timeline`  |
| `dbt-tools inventory`  | `dbt-tools inspect inventory` |
| `dbt-tools search`     | `dbt-tools find resources`    |
| `dbt-tools deps`       | `dbt-tools trace lineage`     |
| `dbt-tools graph`      | `dbt-tools export graph`      |
| `dbt-tools status`     | `dbt-tools check artifacts`   |
| `dbt-tools freshness`  | `dbt-tools check artifacts`   |
| `dbt-tools schema`     | `dbt-tools describe schema`   |

If a removed command is invoked, the CLI fails with a targeted “use X instead” message.

## Schema introspection

Use `describe schema` for machine-readable discovery:

```bash
dbt-tools describe schema
dbt-tools describe schema inspect
dbt-tools describe schema inspect run
dbt-tools describe schema trace lineage
```

Typical automation pattern:

```bash
dbt-tools describe schema trace lineage \
  | jq '.options[] | select(.name == "--direction")'
```

The returned schema includes:

- command path segments
- descriptions
- arguments
- options
- defaults
- enum values where available

## Output-size control

Use `--fields` to shrink payloads when feeding output into automation or LLM context:

```bash
dbt-tools trace lineage model.my_project.customers --fields "unique_id,name"
dbt-tools inspect summary --fields "total_nodes,total_edges"
dbt-tools inspect run --fields "total_execution_time,critical_path"
```

## Recommended automation flow

1. Run `dbt-tools check artifacts` to see what is available locally.
2. Use `dbt-tools find resources` if you do not know the exact `unique_id`.
3. Use `dbt-tools trace lineage` for dependency traversal.
4. Choose `dbt-tools inspect run` for aggregated execution health.
5. Choose `dbt-tools inspect timeline` for row-level execution investigation.
6. Use `dbt-tools describe schema ...` whenever argument or option shapes are unclear.

## Before/after examples

```bash
# Before
dbt-tools status
dbt-tools search orders --json | jq '.results[0].unique_id'
dbt-tools deps model.my_project.customers --direction upstream
dbt-tools run-report --bottlenecks

# After
dbt-tools check artifacts
dbt-tools find resources orders --json | jq '.results[0].unique_id'
dbt-tools trace lineage model.my_project.customers --direction upstream
dbt-tools inspect run --bottlenecks
```
