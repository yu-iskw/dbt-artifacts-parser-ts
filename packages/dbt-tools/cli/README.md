# @dbt-tools/cli

Command-line interface for dbt artifact analysis. Optimized for both human and AI agent consumption.

## Installation

```bash
pnpm add -g @dbt-tools/cli
```

## Features

- **Default `./target` directory**: Commands default to dbt's standard artifact location
- **JSON-by-default**: Machine-readable JSON output in non-interactive environments
- **Input validation**: Hardened against common agent mistakes (path traversals, control chars, etc.)
- **Field filtering**: Reduce context window usage with `--fields` option
- **Schema introspection**: Runtime command discovery via `schema` command
- **Dependency analysis**: Find upstream/downstream dependencies with `deps` command

## Commands

### analyze

Analyze dbt manifest and provide summary statistics.

```bash
# Uses ./target/manifest.json by default
dbt-tools analyze

# Custom target directory
dbt-tools analyze --target-dir ./custom-target

# Explicit path
dbt-tools analyze path/to/manifest.json

# JSON output
dbt-tools analyze --json
```

**Options:**

- `[manifest-path]` - Path to manifest.json (defaults to `./target/manifest.json`)
- `--target-dir <dir>` - Custom target directory
- `--json` - Force JSON output
- `--no-json` - Force human-readable output

### graph

Export dependency graph in various formats.

```bash
# Uses ./target/manifest.json by default
dbt-tools graph

# Export as DOT format
dbt-tools graph --format dot --output graph.dot

# Export as GEXF format
dbt-tools graph --format gexf --output graph.gexf

# Custom target directory
dbt-tools graph --target-dir ./custom-target
```

**Options:**

- `[manifest-path]` - Path to manifest.json (defaults to `./target/manifest.json`)
- `--format <format>` - Export format: `json`, `dot`, or `gexf` (default: `json`)
- `--output <path>` - Output file path (default: stdout)
- `--target-dir <dir>` - Custom target directory

### run-report

Generate execution report from run_results.json.

```bash
# Uses ./target/run_results.json and ./target/manifest.json by default
dbt-tools run-report

# With critical path analysis
dbt-tools run-report

# Custom paths
dbt-tools run-report ./custom/run_results.json ./custom/manifest.json

# JSON output
dbt-tools run-report --json
```

**Options:**

- `[run-results-path]` - Path to run_results.json (defaults to `./target/run_results.json`)
- `[manifest-path]` - Path to manifest.json (optional, for critical path analysis)
- `--target-dir <dir>` - Custom target directory
- `--json` - Force JSON output
- `--no-json` - Force human-readable output

### deps (NEW)

Get upstream or downstream dependencies for a dbt resource.

```bash
# Get downstream dependencies (default)
dbt-tools deps model.my_project.customers

# Get upstream dependencies
dbt-tools deps model.my_project.customers --direction upstream

# With field filtering to reduce output size
dbt-tools deps model.my_project.customers --fields "unique_id,name"

# Custom manifest path
dbt-tools deps model.my_project.customers --manifest-path ./custom/manifest.json
```

**Options:**

- `<resource-id>` - Unique ID of the dbt resource (required)
- `--direction <direction>` - `upstream` or `downstream` (default: `downstream`)
- `--manifest-path <path>` - Path to manifest.json (defaults to `./target/manifest.json`)
- `--target-dir <dir>` - Custom target directory
- `--fields <fields>` - Comma-separated list of fields to include (e.g., `unique_id,name`)
- `--json` - Force JSON output
- `--no-json` - Force human-readable output

**Example Output:**

```json
{
  "resource_id": "model.my_project.customers",
  "direction": "downstream",
  "dependencies": [
    {
      "unique_id": "model.my_project.orders",
      "resource_type": "model",
      "name": "orders",
      "package_name": "my_project"
    }
  ],
  "count": 1
}
```

### schema (NEW)

Get machine-readable schema for commands (runtime introspection).

```bash
# Get schema for specific command
dbt-tools schema deps

# Get all command schemas
dbt-tools schema
```

**Options:**

- `[command]` - Command name (if omitted, returns all schemas)
- `--json` - Force JSON output (always JSON by default)

**Use Cases:**

- Discover available commands and options at runtime
- Understand argument requirements
- Get example usage for each command

## Default Directory Behavior

All commands default to the `./target` directory where dbt stores artifacts:

- `manifest.json` → `./target/manifest.json`
- `run_results.json` → `./target/run_results.json`

Override with:

- `--target-dir <directory>` flag
- `DBT_TARGET_DIR` environment variable

## JSON Output

The CLI automatically outputs JSON when stdout is not a TTY (non-interactive environments):

- **Non-TTY (agents/pipes)**: JSON output by default
- **TTY (interactive)**: Human-readable output by default
- Use `--json` to force JSON
- Use `--no-json` to force human-readable

## Field Filtering

Use `--fields` to limit response size and reduce context window usage:

```bash
# Only return specific fields
dbt-tools deps model.my_project.customers --fields "unique_id,name"

# Supports nested fields
dbt-tools deps model.my_project.customers --fields "unique_id,name,attributes.resource_type"
```

## Input Validation

The CLI validates all inputs to prevent common mistakes:

- **Path traversals**: Rejects `../` and `..\\` patterns
- **Control characters**: Rejects invisible characters
- **Resource IDs**: Rejects embedded query params (`?`, `#`) and URL-encoded strings
- **Pre-encoded URLs**: Rejects patterns like `%2e%2e`

## Examples

```bash
# Basic analysis (uses ./target/manifest.json)
dbt-tools analyze

# Find downstream dependencies
dbt-tools deps model.my_project.customers

# Find upstream dependencies with minimal output
dbt-tools deps model.my_project.customers --direction upstream --fields "unique_id"

# Export graph for visualization
dbt-tools graph --format dot --output graph.dot

# Execution report with critical path
dbt-tools run-report

# Get command schema
dbt-tools schema deps | jq '.options[] | select(.name == "--direction")'
```

## Agent Usage

For AI agents, see [CONTEXT.md](./CONTEXT.md) for detailed guidance on:

- Default artifact locations
- Field filtering best practices
- Input validation expectations
- Common patterns and examples
- Error handling

## Environment Variables

- `DBT_TARGET_DIR` - Override default target directory (defaults to `./target`)
