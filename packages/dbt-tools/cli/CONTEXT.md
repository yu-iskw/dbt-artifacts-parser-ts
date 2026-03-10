# Agent Context Guide for dbt-tools CLI

This document provides guidance for AI agents using the dbt-tools CLI.

## Default Artifact Location

The CLI defaults to the `./target` directory where dbt stores artifacts:

- `manifest.json` → `./target/manifest.json`
- `run_results.json` → `./target/run_results.json`

You can override this with:

- `--target-dir <directory>` flag
- `DBT_TARGET_DIR` environment variable

**Example:**

```bash
# Uses ./target/manifest.json by default
dbt-tools analyze

# Custom directory
dbt-tools analyze --target-dir ./custom-target

# Explicit path still works
dbt-tools analyze ./path/to/manifest.json
```

## JSON Output by Default

When stdout is not a TTY (non-interactive environments), the CLI outputs JSON by default for machine consumption.

- **Non-TTY (agents)**: JSON output by default
- **TTY (humans)**: Human-readable output by default
- Use `--json` to force JSON output
- Use `--no-json` to force human-readable output

**Example:**

```bash
# In non-TTY: outputs JSON
dbt-tools analyze | jq .

# Force human-readable
dbt-tools analyze --no-json
```

## Field Filtering for Context Window Management

Use `--fields` to limit response size and reduce context window usage:

```bash
# Only return unique_id and name fields
dbt-tools deps model.my_project.customers --fields "unique_id,name"

# Supports nested fields
dbt-tools deps model.my_project.customers --fields "unique_id,name,attributes.resource_type"
```

**Always use field filtering when:**

- Processing large dependency lists
- Only need specific fields
- Working with large manifests (1000+ nodes)

## Input Validation

The CLI validates all inputs to prevent common agent mistakes:

- **Path traversals**: Rejects `../` and `..\\` patterns
- **Control characters**: Rejects invisible characters (< 0x20 except \n, \r, \t)
- **Resource IDs**: Rejects embedded query params (`?`, `#`) and URL-encoded strings (`%`)
- **Pre-encoded URLs**: Rejects patterns like `%2e%2e` (encoded `..`)

**Common mistakes to avoid:**

- ❌ `model.x?fields=name` (embedded query param)
- ❌ `model%2ex` (pre-encoded)
- ❌ `../../.ssh` (path traversal)
- ✅ `model.my_project.customers` (correct)

## Finding Dependencies

### Downstream Dependencies (Default)

Find what depends on a resource:

```bash
# Get downstream dependencies (default)
dbt-tools deps model.my_project.customers

# With field filtering
dbt-tools deps model.my_project.customers --fields "unique_id,name"
```

### Upstream Dependencies

Find what a resource depends on:

```bash
dbt-tools deps model.my_project.customers --direction upstream
```

## Command Schema Introspection

Get machine-readable command schemas at runtime:

```bash
# Get schema for specific command
dbt-tools schema deps

# Get all command schemas
dbt-tools schema
```

Use this to discover:

- Required vs optional arguments
- Available options and their types
- Default values
- Example usage

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

Error codes:

- `VALIDATION_ERROR`: Input validation failed
- `FILE_NOT_FOUND`: Artifact file not found
- `PARSE_ERROR`: Failed to parse JSON
- `UNSUPPORTED_VERSION`: Unsupported dbt version
- `UNKNOWN_ERROR`: Other errors

## Common Patterns

### Pattern 1: Find Downstream Impact

```bash
# What depends on this model?
dbt-tools deps model.my_project.customers --fields "unique_id,name"
```

### Pattern 2: Analyze Project Structure

```bash
# Get summary statistics
dbt-tools analyze

# Export graph for visualization
dbt-tools graph --format dot --output graph.dot
```

### Pattern 3: Execution Analysis

```bash
# Basic execution report
dbt-tools run-report

# With critical path (requires manifest)
dbt-tools run-report ./target/run_results.json ./target/manifest.json
```

## Best Practices

1. **Always use field filtering** for dependency queries to reduce context window usage
2. **Use default `./target` directory** unless you have a specific reason not to
3. **Validate resource IDs** before querying (use schema introspection if unsure)
4. **Handle errors programmatically** using error codes in non-interactive environments
5. **Use schema introspection** to discover command capabilities at runtime

## Environment Variables

- `DBT_TARGET_DIR`: Override default target directory (defaults to `./target`)

## Examples

```bash
# Find downstream dependencies with minimal output
dbt-tools deps model.my_project.customers --fields "unique_id" --json

# Analyze project structure
dbt-tools analyze --json | jq '.nodes_by_type'

# Get command help via schema
dbt-tools schema deps | jq '.options[] | select(.name == "--direction")'
```
