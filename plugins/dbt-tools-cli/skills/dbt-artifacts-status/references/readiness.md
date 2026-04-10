# Readiness and command availability

`dbt-tools status` sets **`readiness`** from local files only: **`manifest.json`** and **`run_results.json`** under the resolved target directory (default `./target`). It does **not** inspect remote object storage or cloud artifact sources.

## Matrix

| `readiness`     | Safe to run (typical)                                                                 | Avoid / expect failure                                                                                |
| --------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `full`          | `summary`, `graph`, `deps`, `inventory`, `search`, `timeline`, `run-report`, `status` | —                                                                                                     |
| `manifest-only` | `summary`, `graph`, `deps`, `inventory`, `search`, `status`                           | `timeline`, `run-report` (require `run_results.json`)                                                 |
| `unavailable`   | `status` (and `freshness` alias)                                                      | `summary`, `graph`, `deps`, `inventory`, `search`, `timeline`, `run-report` (require `manifest.json`) |

## Notes

- **`schema`** introspection does not require artifacts; it describes the CLI itself.
- Commands that need **`catalog.json`** (for example `graph --field-level`) still require a valid **`manifest.json`** path first; readiness `unavailable` means those flows are blocked until a manifest exists.
- If the user’s project uses a non-default target directory, pass **`--target-dir`** or set **`DBT_TOOLS_TARGET_DIR`** consistently for `status` and all follow-up commands.
