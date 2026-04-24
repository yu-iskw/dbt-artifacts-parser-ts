<!-- markdownlint-disable MD013 MD060 -->
# status — command cheat sheet

## Stable invocation

```bash
dbt-tools status --dbt-target ./target --json
```

- **`--json`**: Prefer for agents so stdout is JSON; stderr can carry structured error JSON for modeled failures (see CLI “Error handling”).

```bash
export DBT_TOOLS_DBT_TARGET=./target
dbt-tools status --json
```

- **`freshness`**: alias of `status` (same behavior).

## Readiness (stdout JSON)

| `readiness`     | Typically means                                                                          |
| --------------- | ---------------------------------------------------------------------------------------- |
| `full`          | `manifest.json` and `run_results.json` present.                                          |
| `manifest-only` | `manifest.json` only—graph/manifest analysis possible; run-result-only commands are not. |
| `unavailable`   | `manifest.json` missing—most artifact commands will fail.                                |

## Bounding output

- `status` is small; you rarely need **`--fields`**. If the schema supports it and the payload is large, trim fields the same way as other commands (see `dbt-tools schema status`).

## When to use `status`

- The user **asks** if artifacts are present, fresh, or ready.
- You **suspect** missing or stale files after a confusing error.
- You are **onboarding** in a new environment and need a one-shot bundle check.

**Not required** before every other `dbt-tools` call when `--dbt-target` is already trusted.

## Common failure modes (plain language)

| Symptom                                                | Likely cause                            | What to do                                                                 |
| ------------------------------------------------------ | --------------------------------------- | -------------------------------------------------------------------------- |
| No `--dbt-target` and no `DBT_TOOLS_DBT_TARGET`        | Artifact root not specified             | Set env or pass `--dbt-target`.                                            |
| `readiness: "unavailable"`                             | No `manifest.json`                      | Generate/copy dbt artifacts into the target.                               |
| Run-scoped command fails; `readiness: "manifest-only"` | `run_results.json` missing              | Run a dbt command that produces `run_results`, or use manifest-only tools. |
| Error about **remote** / credentials                   | S3 or GCS access                        | Check AWS/GCP config and prefix (see main CLI README).                     |
| `VALIDATION_ERROR` in structured stderr                | Bad path or invalid characters in flags | Fix input; do not pass URL query fragments in resource or path args.       |

## If behavior or flags differ

Use runtime discovery, not hard-coded option lists:

```bash
dbt-tools schema
dbt-tools schema status
dbt-tools status --help
```
