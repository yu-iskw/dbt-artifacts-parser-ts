# @dbt-tools/cli

**Structured interface** for dbt artifact analysis: machine-readable JSON by default in non-interactive environments, runtime **`describe schema`** introspection, **`--fields`** to shrink payloads, and validated inputs with stable error codes. The vNext CLI uses a **task-oriented hierarchy** so humans and coding agents can guess commands more reliably and still discover the full surface at runtime.

**Quick start:** install Node.js **20+** (see the repo [`.node-version`](https://github.com/yu-iskw/dbt-artifacts-parser-ts/blob/main/.node-version) for the version used in development; Node 18 is EOL — [releases](https://nodejs.org/en/about/previous-releases)), then `npm install -g @dbt-tools/cli` and run `dbt-tools inspect summary` from a directory that contains `./target/manifest.json`. Extended notes, migration guidance, and agent-oriented patterns are in the [user guide](../../../docs/user-guide-dbt-tools-cli.md). Positioning: [ADR-0035](../../../docs/adr/0035-dbt-tools-operational-intelligence-and-positioning-boundaries.md).

## Task Families

```text
dbt-tools inspect <summary|run|timeline|inventory>
dbt-tools find <resources>
dbt-tools trace <lineage>
dbt-tools export <graph>
dbt-tools check <artifacts>
dbt-tools describe <schema>
```

- `inspect summary` - manifest-level summary statistics
- `inspect run` - aggregated execution report from `run_results.json`
- `inspect timeline` - row-level execution entries from `run_results.json`
- `inspect inventory` - enumerate and filter manifest resources
- `find resources` - discover likely matches from text and filters
- `trace lineage` - upstream/downstream dependency traversal from a resource
- `export graph` - graph export, focused subgraphs, and field-level lineage
- `check artifacts` - artifact presence, recency, and readiness
- `describe schema` - machine-readable schema for the full tree or a specific path

## Installation

```bash
pnpm add -g @dbt-tools/cli
```

## Common Examples

```bash
# Check local artifact readiness before analysis
dbt-tools check artifacts

# Get a manifest-level summary
dbt-tools inspect summary

# Find likely matches before tracing lineage
dbt-tools find resources orders --json

# Enumerate structured inventory with filters
dbt-tools inspect inventory --type model --tag finance

# Trace downstream lineage from a resource
dbt-tools trace lineage model.my_project.customers

# Trace upstream lineage with a smaller JSON payload
dbt-tools trace lineage model.my_project.customers \
  --direction upstream --fields "unique_id"

# Inspect an aggregated run report
dbt-tools inspect run --bottlenecks

# Inspect row-level execution entries
dbt-tools inspect timeline --top 10
dbt-tools inspect timeline --failed-only

# Export a focused subgraph
dbt-tools export graph \
  --focus model.my_project.orders \
  --focus-direction downstream \
  --resource-types model,test
```

## Help And Schema Discovery

Both humans and agents should treat CLI help and schema introspection as first-class discovery surfaces.

```bash
# Human-oriented discovery
dbt-tools --help
dbt-tools inspect --help
dbt-tools trace lineage --help

# Machine-readable discovery
dbt-tools describe schema
dbt-tools describe schema inspect
dbt-tools describe schema inspect run
dbt-tools describe schema trace lineage
```

Example:

```bash
dbt-tools describe schema trace lineage | jq '.options[] | select(.name == "--direction")'
```

## Command Reference

### inspect summary

Provide summary statistics for the dbt manifest.

```bash
dbt-tools inspect summary
dbt-tools inspect summary --target-dir ./custom-target
dbt-tools inspect summary path/to/manifest.json
dbt-tools inspect summary --fields "total_nodes,total_edges"
dbt-tools inspect summary --json
```

**Options:**

- `[manifest-path]` - Path to manifest.json (defaults to `./target/manifest.json`)
- `--target-dir <dir>` - Custom target directory
- `--fields <fields>` - Comma-separated list of fields to include
- `--json` - Force JSON output
- `--no-json` - Force human-readable output

### inspect run

Generate an **aggregated** execution report from `run_results.json` (totals, critical path, bottlenecks). For **row-level** per-node timings, use [`inspect timeline`](#inspect-timeline) instead.

```bash
dbt-tools inspect run
dbt-tools inspect run --bottlenecks
dbt-tools inspect run --bottlenecks --bottlenecks-top 5
dbt-tools inspect run --bottlenecks --bottlenecks-threshold 10
dbt-tools inspect run --fields "total_execution_time,critical_path"
dbt-tools inspect run ./custom/run_results.json ./custom/manifest.json
dbt-tools inspect run --json
```

**Options:**

- `[run-results-path]` - Path to run_results.json (defaults to `./target/run_results.json`)
- `[manifest-path]` - Path to manifest.json (optional, for critical path analysis)
- `--target-dir <dir>` - Custom target directory
- `--fields <fields>` - Comma-separated list of fields to include
- `--bottlenecks` - Include bottleneck section in report
- `--bottlenecks-top <n>` - Top N slowest nodes
- `--bottlenecks-threshold <s>` - Nodes exceeding s seconds
- `--adapter-summary` - Include adapter_response aggregates
- `--adapter-top-by <metric>` - Rank nodes by adapter metric
- `--adapter-top-n <n>` - Top N for `--adapter-top-by`
- `--adapter-min-bytes <n>` - Minimum bytes_processed threshold
- `--adapter-min-slot-ms <n>` - Minimum slot_ms threshold
- `--adapter-min-rows-affected <n>` - Minimum rows_affected threshold
- `--json` - Force JSON output
- `--no-json` - Force human-readable output

### inspect timeline

Show **row-level execution entries** from `run_results.json`. This is the row-level complement to `inspect run`.

```bash
dbt-tools inspect timeline
dbt-tools inspect timeline /path/to/run_results.json /path/to/manifest.json
dbt-tools inspect timeline --top 20
dbt-tools inspect timeline --failed-only
dbt-tools inspect timeline --status error,warn
dbt-tools inspect timeline --sort start
dbt-tools inspect timeline --format csv > timeline.csv
dbt-tools inspect timeline --json
```

**Options:**

- `[run-results-path]` - Path to run_results.json (defaults to `./target/run_results.json`)
- `[manifest-path]` - Path to manifest.json (optional, enriches rows with name and resource_type)
- `--sort <key>` - Sort order, default `duration`
- `--top <n>` - Show top N entries only
- `--failed-only` - Show only non-successful entries
- `--status <status>` - Filter by status, comma-separated
- `--adapter-text <text>` - Filter by normalized adapter text
- `--format <format>` - Output format: `json`, `table`, or `csv`
- `--target-dir <dir>` - Custom target directory
- `--json` - Force JSON output
- `--no-json` - Force human-readable output

### inspect inventory

List and filter dbt resources from the manifest. Use this when you already know you want a structured inventory view rather than fuzzy search.

```bash
dbt-tools inspect inventory
dbt-tools inspect inventory --type model
dbt-tools inspect inventory --type model,test
dbt-tools inspect inventory --package my_project
dbt-tools inspect inventory --tag finance
dbt-tools inspect inventory --path models/staging
dbt-tools inspect inventory --type model --tag finance --package my_project
dbt-tools inspect inventory --type model --fields "entries"
dbt-tools inspect inventory --json
```

### find resources

Discover dbt resources by name, tag, type, or free-text query. Use this when you need to find a likely resource before running a more specific command.

```bash
dbt-tools find resources orders
dbt-tools find resources "type:model orders"
dbt-tools find resources "tag:finance"
dbt-tools find resources --type model
dbt-tools find resources --tag finance
dbt-tools find resources --package my_project
dbt-tools find resources orders --type model
dbt-tools find resources orders --no-json
dbt-tools find resources orders --json
```

### trace lineage

Get upstream or downstream dependencies for a dbt resource.

```bash
dbt-tools trace lineage model.my_project.customers
dbt-tools trace lineage model.my_project.customers --direction upstream
dbt-tools trace lineage model.my_project.customers --depth 1
dbt-tools trace lineage model.my_project.customers --format flat
dbt-tools trace lineage model.my_project.customers --direction upstream --build-order
dbt-tools trace lineage model.my_project.customers --fields "unique_id,name"
dbt-tools trace lineage model.my_project.customers --manifest-path ./custom/manifest.json
```

### export graph

Export dependency graph in various formats, including focused subgraphs.

```bash
dbt-tools export graph
dbt-tools export graph --format dot --output graph.dot
dbt-tools export graph --format gexf --output graph.gexf
dbt-tools export graph --format json --fields "name,resource_type"
dbt-tools export graph --focus model.my_project.orders --focus-depth 2
dbt-tools export graph --focus model.my_project.orders --focus-direction upstream
dbt-tools export graph --target-dir ./custom-target
```

### check artifacts

Report dbt artifact presence, file modification times, and analysis readiness. This command does **not** parse artifact content; it inspects the filesystem only.

```bash
dbt-tools check artifacts
dbt-tools check artifacts --target-dir ./custom-target
dbt-tools check artifacts --json
```

Readiness values:

| Value           | Meaning                                                                                                             |
| :-------------- | :------------------------------------------------------------------------------------------------------------------ |
| `full`          | Both `manifest.json` and `run_results.json` are present. All analysis commands are available.                       |
| `manifest-only` | `manifest.json` is present and `run_results.json` is missing. `inspect run` and `inspect timeline` are unavailable. |
| `unavailable`   | `manifest.json` is not found. Most analysis commands will fail.                                                     |

### describe schema

Get machine-readable schema for the full command tree or a specific command path.

```bash
dbt-tools describe schema
dbt-tools describe schema inspect
dbt-tools describe schema inspect run
dbt-tools describe schema trace lineage
```

## Field Filtering

Use `--fields` to limit response size and reduce context window usage. Supported in `inspect summary`, `inspect run`, `inspect inventory`, `find resources`, `trace lineage`, and JSON mode of `export graph`.

```bash
dbt-tools trace lineage model.my_project.customers --fields "unique_id,name"
dbt-tools inspect summary --fields "total_nodes,total_edges"
```

## Patterns For Agents And Automation

- Run `dbt-tools check artifacts` first to see which artifacts are available.
- Use `dbt-tools find resources` before `dbt-tools trace lineage` if the exact `unique_id` is unknown.
- Prefer `--json` in automation and pair it with `--fields` when you only need a subset.
- Use `dbt-tools describe schema ...` when option shapes are unclear at runtime.
- Choose `inspect run` for aggregated execution health and `inspect timeline` for row-level investigation.
