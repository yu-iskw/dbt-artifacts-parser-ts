# User guide: @dbt-tools/cli

Extended notes for operators and automation using **`dbt-tools`**. The CLI is the **structured interface** to dbt artifact analysis: JSON-oriented defaults, `schema` for runtime discovery, and `--fields` to bound payloads—suited to CI, scripts, and coding-agent skills alike. For product positioning (operational intelligence layer, composable substrate), see [ADR-0035](./adr/0035-dbt-tools-operational-intelligence-and-positioning-boundaries.md). For the full command reference (`summary`, `graph`, `run-report`, `deps`, `schema`), see the [package README](../packages/dbt-tools/cli/README.md).

---

## Quick orientation

- **Binary:** `dbt-tools` (from `@dbt-tools/cli`)
- **Defaults:** artifact paths under **`./target`** (`manifest.json`, `run_results.json`)
- **Output:** JSON when stdout is **not** a TTY; human text in an interactive terminal — override with `--json` / `--no-json`
- **Discovery:** `dbt-tools schema` and `dbt-tools schema <command>` for machine-readable option metadata
- **Directory / prefix mode:** every artifact command accepts **`--source`** (`local` \| `s3` \| `gcs`), **`--location`**, and optional **`--run-id`** when discovery finds multiple complete `manifest.json` + `run_results.json` sets—same grouping rules as `@dbt-tools/web`. Do not mix with per-file path flags for the same invocation.

Install:

```bash
npm install -g @dbt-tools/cli
# or:
npx @dbt-tools/cli --help
```

---

## Schema introspection

Discover commands and flags at runtime (useful for agents):

```bash
dbt-tools schema
dbt-tools schema deps
```

Example: inspect an option with `jq`:

```bash
dbt-tools schema deps | jq '.options[] | select(.name == "--direction")'
```

---

## Field filtering

Use **`--fields`** on `summary`, `deps`, `graph` (JSON), and `run-report` to shrink payloads:

```bash
dbt-tools deps model.my_project.customers --fields "unique_id,name"
dbt-tools deps model.my_project.customers --fields "unique_id,name,attributes.resource_type"
```

---

## Input validation

The CLI rejects unsafe or ambiguous inputs:

- Path segments like **`../`** / **`..\`**
- Control characters (below `0x20`, except newline / CR / tab)
- Resource IDs containing **`?`**, **`#`**, or **`%`** (including encoded traversal like `%2e%2e`)

**Valid example:** `model.my_project.customers`
**Invalid examples:** `model.x?fields=name`, `model%2ex`, `../../.ssh`

---

## Error handling (non-TTY / agents)

Errors are JSON with a stable **`code`** field:

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

| Code                  | Meaning                        |
| --------------------- | ------------------------------ |
| `VALIDATION_ERROR`    | Input validation failed        |
| `FILE_NOT_FOUND`      | Artifact file missing          |
| `PARSE_ERROR`         | Invalid JSON                   |
| `UNSUPPORTED_VERSION` | Artifact version not supported |
| `UNKNOWN_ERROR`       | Other failure                  |

---

## Best practices for AI agents

1. Prefer **`--fields`** on large outputs.
2. Use default **`./target`** unless paths must differ.
3. Use **`dbt-tools schema`** when argument shapes are unclear.
4. Branch on **`code`** in JSON error bodies in scripts.
5. Keep resource IDs literal dbt **`unique_id`** strings — never URL-encode or append query parameters.

---

## Environment variables

| Variable               | Purpose                                                 |
| ---------------------- | ------------------------------------------------------- |
| `DBT_TOOLS_TARGET_DIR` | Default target directory (replaces `./target`)          |
| Legacy                 | `DBT_TARGET_DIR`, `DBT_TARGET` (deprecated; still read) |

---

## Related

- [Package README](../packages/dbt-tools/cli/README.md) — full command reference
- [CONTRIBUTING.md](../CONTRIBUTING.md) — building and testing from source
- [@dbt-tools/core README](../packages/dbt-tools/core/README.md) — library API used by the CLI
