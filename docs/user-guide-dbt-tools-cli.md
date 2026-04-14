# User guide: @dbt-tools/cli

Extended notes for operators and automation using **`dbt-tools`**. The CLI is the **structured interface** to dbt artifact analysis: JSON-oriented defaults, `schema` for runtime discovery, and `--fields` to bound payloads—suited to CI, scripts, and coding-agent skills alike. For product positioning (operational intelligence layer, composable substrate), see [ADR-0035](./adr/0035-dbt-tools-operational-intelligence-and-positioning-boundaries.md). For the full command reference (`summary`, `graph`, `run-report`, `deps`, `schema`), see the [package README](../packages/dbt-tools/cli/README.md).

---

## Quick orientation

- **Binary:** `dbt-tools` (from `@dbt-tools/cli`)
- **Artifact root:** pass **`--dbt-target`** on every command that reads artifacts (local directory, or **`s3://bucket/prefix`** / **`gs://bucket/prefix`** with a strict scheme). If the flag is omitted, the CLI reads **`DBT_TOOLS_DBT_TARGET`**; if that is unset or empty, the command fails with a clear message.
- **Fixed keys:** the CLI loads **`manifest.json`** and **`run_results.json`** from that root (required). **`catalog.json`** and **`sources.json`** are included when present. There is **no** multi-run listing or `--run-id` selection in the CLI.
- **Output:** JSON on stdout when stdout is **not** a TTY; human text in an interactive terminal — override with **`--json`** / **`--no-json`**
- **Discovery:** `dbt-tools schema` and `dbt-tools schema <command>` for machine-readable option metadata

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
dbt-tools deps --dbt-target ./target model.my_project.customers --fields "unique_id,name"
dbt-tools deps --dbt-target ./target model.my_project.customers --fields "unique_id,name,attributes.resource_type"
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

## Error handling (humans vs `--json`)

- **Default:** failures print **human-readable** messages on stderr (including checklist-style hints when required artifact files are missing).
- **Structured JSON on stderr** is emitted **only when you pass `--json`** for that invocation. Do not assume non-TTY mode implies JSON errors.

```json
{
  "error": "ArtifactBundleResolutionError",
  "code": "ARTIFACT_BUNDLE_INCOMPLETE",
  "message": "Required dbt artifacts are missing at the given target.",
  "details": {
    "target": "./target",
    "provider": "local",
    "missing": ["manifest.json"],
    "found": ["run_results.json"]
  }
}
```

| Code                         | Meaning                                    |
| ---------------------------- | ------------------------------------------ |
| `VALIDATION_ERROR`           | Input validation failed                    |
| `ARTIFACT_BUNDLE_INCOMPLETE` | Required fixed filenames missing at target |
| `FILE_NOT_FOUND`             | Artifact file missing (other cases)        |
| `PARSE_ERROR`                | Invalid JSON                               |
| `UNSUPPORTED_VERSION`        | Artifact version not supported             |
| `UNKNOWN_ERROR`              | Other failure                              |

---

## Best practices for AI agents

1. Prefer **`--fields`** on large outputs.
2. Set **`DBT_TOOLS_DBT_TARGET`** in the environment (or pass **`--dbt-target`**) so every artifact command resolves the same root.
3. Use **`dbt-tools schema`** when argument shapes are unclear.
4. Pass **`--json`** when scripts need **machine-readable stderr**; branch on **`code`** in those bodies.
5. Keep resource IDs literal dbt **`unique_id`** strings — never URL-encode or append query parameters.

---

## Environment variables

| Variable                  | Purpose                                                                           |
| ------------------------- | --------------------------------------------------------------------------------- |
| `DBT_TOOLS_DBT_TARGET`    | Default **`--dbt-target`** when the flag is omitted (local or `s3`/`gs` URI)      |
| `DBT_TOOLS_REMOTE_SOURCE` | JSON config merged for **`s3://`** / **`gs://`** targets (credentials, endpoints) |

---

## Related

- [Package README](../packages/dbt-tools/cli/README.md) — full command reference
- [CONTRIBUTING.md](../CONTRIBUTING.md) — building and testing from source
- [@dbt-tools/core README](../packages/dbt-tools/core/README.md) — library API used by the CLI
