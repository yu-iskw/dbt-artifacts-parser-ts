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

### summary

Provide summary statistics for dbt manifest.

```bash
# Uses ./target/manifest.json by default
dbt-tools summary

# Custom target directory
dbt-tools summary --target-dir ./custom-target

# Explicit path
dbt-tools summary path/to/manifest.json

# Field filtering to reduce context window usage
dbt-tools summary --fields "total_nodes,total_edges"

# JSON output
dbt-tools summary --json
```

**Options:**

- `[manifest-path]` - Path to manifest.json (defaults to `./target/manifest.json`)
- `--target-dir <dir>` - Custom target directory
- `--fields <fields>` - Comma-separated list of fields to include
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

# With field filtering (only affects JSON format)
dbt-tools graph --format json --fields "name,resource_type"

# Custom target directory
dbt-tools graph --target-dir ./custom-target
```

**Options:**

- `[manifest-path]` - Path to manifest.json (defaults to `./target/manifest.json`)
- `--format <format>` - Export format: `json`, `dot`, or `gexf` (default: `json`)
- `--output <path>` - Output file path (default: stdout)
- `--target-dir <dir>` - Custom target directory
- `--fields <fields>` - Comma-separated list of fields to include (affects JSON nodes)

### run-report

Generate execution report from run_results.json.

```bash
# Uses ./target/run_results.json and ./target/manifest.json by default
dbt-tools run-report

# With critical path analysis
dbt-tools run-report

# Field filtering
dbt-tools run-report --fields "total_execution_time,critical_path"

# Custom paths
dbt-tools run-report ./custom/run_results.json ./custom/manifest.json

# JSON output
dbt-tools run-report --json
```

**Options:**

- `[run-results-path]` - Path to run_results.json (defaults to `./target/run_results.json`)
- `[manifest-path]` - Path to manifest.json (optional, for critical path analysis)
- `--target-dir <dir>` - Custom target directory
- `--fields <fields>` - Comma-separated list of fields to include
- `--json` - Force JSON output
- `--no-json` - Force human-readable output

### deps

Get upstream or downstream dependencies for a dbt resource.

```bash
# Get downstream dependencies (default)
dbt-tools deps model.my_project.customers

# Get upstream dependencies
dbt-tools deps model.my_project.customers --direction upstream

# Get immediate neighbors only
dbt-tools deps model.my_project.customers --depth 1

# Output as a flat list
dbt-tools deps model.my_project.customers --format flat

# Get upstream dependencies in build order
dbt-tools deps model.my_project.customers --direction upstream --build-order

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
- `--depth <number>` - Max traversal depth; 1 = immediate neighbors, omit for all levels
- `--format <format>` - Output structure: `flat` or `tree` (default: `tree`)
- `--build-order` - Output upstream dependencies in topological build order
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

### schema

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

Use `--fields` to limit response size and reduce context window usage. This is supported in `summary`, `deps`, `graph` (JSON), and `run-report`.

```bash
# Only return specific fields
dbt-tools deps model.my_project.customers --fields "unique_id,name"

# Supports nested fields
dbt-tools deps model.my_project.customers --fields "unique_id,name,attributes.resource_type"
```

## Input Validation

The CLI validates all inputs to prevent common mistakes:

- **Path traversals**: Rejects `../` and `..\\` patterns
- **Control characters**: Rejects invisible characters (< 0x20 except `\n`, `\r`, `\t`)
- **Resource IDs**: Rejects embedded query params (`?`, `#`) and URL-encoded strings (`%`)
- **Pre-encoded URLs**: Rejects patterns like `%2e%2e` (encoded `..`)

**Common mistakes to avoid:**

- ❌ `model.x?fields=name` (embedded query param)
- ❌ `model%2ex` (pre-encoded)
- ❌ `../../.ssh` (path traversal)
- ✅ `model.my_project.customers` (correct)

## Error Handling

Errors are formatted as JSON in non-TTY environments:

```json
{
  "error": "ValidationError",
  "code": "VALIDATION_ERROR",
  "message": "Resource ID contains invalid characters",
  "details": {
    "field": "resource_id"
  }
}
```

**Common Error Codes:**

- `VALIDATION_ERROR`: Input validation failed
- `FILE_NOT_FOUND`: Artifact file not found
- `PARSE_ERROR`: Failed to parse JSON
- `UNSUPPORTED_VERSION`: Unsupported dbt version
- `UNKNOWN_ERROR`: Other errors

## Best Practices for AI Agents

1. **Always use field filtering** for dependency queries and analysis to reduce context window usage.
2. **Use default `./target` directory** unless you have a specific reason not to.
3. **Validate resource IDs** before querying (use schema introspection if unsure).
4. **Handle errors programmatically** using error codes in non-interactive environments.
5. **Use schema introspection** to discover command capabilities at runtime.

## Examples

```bash
# Basic summary (uses ./target/manifest.json)
dbt-tools summary

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

## Environment Variables

- `DBT_TARGET_DIR` - Override default target directory (defaults to `./target`)
