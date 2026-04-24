# explain & impact — command cheat sheet

## Baseline (agent-friendly)

```bash
dbt-tools explain model.my_project.orders --dbt-target ./target --json
dbt-tools impact model.my_project.orders --dbt-target ./target --json
```

- **Positional** resource argument: often a `unique_id`; the CLI may also **resolve** shorter strings—treat the JSON **resolved** identifiers as the source of truth.
- With **`--json`**, expect JSON **stdout** and, on failures, **structured stderr** (stable **`code`**) for modeled errors.

## Environment (optional)

When **`DBT_TOOLS_WEB_BASE_URL`** is set, JSON may include **deep links** into the dbt-tools web app for the same resource. This is **optional**—local-only workflows still work.

## Tracing (optional, if available)

```bash
dbt-tools explain model.my_project.orders --dbt-target ./target --json --trace
dbt-tools impact model.my_project.orders --dbt-target ./target --json --trace
```

- **`--trace`** (when supported) adds an **`investigation_transcript`**-style object for debugging. Confirm in `dbt-tools schema` before relying in automation.

## Bounding output

- **`--fields`**: use to shrink the JSON when you *know* valid dotted paths from the schema. If uncertain, run **once without `--fields`**, or inspect **`dbt-tools schema explain`** for allowed paths.
- Do not use **`--fields`** to hide errors—errors still surface in stderr; fix the **inputs** or **target** if results are empty.

## When to use which intent

| User question | Start with |
| ------------- | ---------- |
| “What is this model/test/source?” | `explain` |
| “What is the impact / who depends on this (high level)?” | `impact` |
| “List upstream/downstream with depth and tree/flat” | `deps` |
| “I only have a vague name or typo” | `discover` (then `explain` / `impact`) |

## Common failure modes

| Symptom | Likely cause | What to do |
| ------- | ------------ | ---------- |
| `usage:` / unknown command | Old CLI or typo | `dbt-tools schema`; upgrade `@dbt-tools/cli`. |
| `VALIDATION_ERROR` | Malformed id or disallowed characters | Re-copy `unique_id` or resolve via `search`/`discover`. |
| `ARTIFACT_BUNDLE_INCOMPLETE` | Missing `manifest.json` (or other required files) | Point `--dbt-target` at a directory with a manifest. |
| Empty or null sections | **Fields** over-filtering | Drop `--fields` and re-run, or check schema. |
| Ambiguous resolution in JSON | Multiple candidates | Tighten query or use `discover` first. |

## Confirmed current behavior (do this, do not guess)

```bash
dbt-tools schema
dbt-tools schema explain
dbt-tools schema impact
dbt-tools explain --help
dbt-tools impact --help
```
