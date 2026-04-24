<!-- markdownlint-disable MD013 MD060 -->
# discover & search — command cheat sheet

## Contract (high level)

- Pass **`--dbt-target <local|s3|gs>`** (or set **`DBT_TOOLS_DBT_TARGET`**) the same way as other commands. Trust a user-provided value unless you see evidence it is wrong.
- Prefer **`--json`** for agent parsing. With **`--json`**, use structured stderr for modeled failures.
- **Bound** large result sets: **`--limit` / `--offset`**, and **`--fields`** to shrink each row when you know the shape you need.
- **Files at the target:** as of current CLI documentation, **`discover`** only needs **`manifest.json`**, while **`search`** is documented with **`manifest.json` + `run_results.json`**. If a command errors about a missing file, re-check the target and run `dbt-tools status --json` when the user is unsure.

## `search` — quick find

```bash
dbt-tools search --dbt-target ./target "orders" --json
dbt-tools search --dbt-target ./target "type:model" "orders" --json
dbt-tools search --dbt-target ./target --type model --tag finance --json
```

(Inline **`type:`**, **`tag:`**, **`package:`** tokens may appear in the query string; exact token support is defined by the current CLI—verify with `dbt-tools search --help` if a token fails.)

```bash
# Page (keep slices small in agent context)
dbt-tools search --dbt-target ./target "orders" --limit 20 --offset 0 --json
```

**Typical use**: quickly list **`results`**; read **`unique_id`**, **`name`**, **`resource_type`**, **`package_name`**, **`path`**.

**Zero or huge results**: add filters, shorten free text, or move to `discover` for ranked reasons.

## `discover` — ranked, explainable

```bash
dbt-tools discover --dbt-target ./target "ordrs" --json
dbt-tools discover --dbt-target ./target --type model --limit 30 --json
```

**Typical use**: fuzzy / typo-tolerant name resolution, **disambiguation** peers, richer follow-up context in JSON. Prefer **`discover`** when the user’s wording is vague or you need _why_ something ranked.

**Optional** (if available): **`--trace`** adds a small **investigation transcript** in JSON for debugging—use sparingly; check `dbt-tools schema discover`.

## Choosing `search` vs `discover`

| Situation                          | Lean toward                 |
| ---------------------------------- | --------------------------- |
| Known substring in name/path       | `search`                    |
| Typo, nickname, or “most relevant” | `discover`                  |
| Need minimal JSON                  | `search` with tight filters |
| Need disambiguation story          | `discover`                  |

## Common failure modes

| Symptom                                         | Likely cause                                  | What to do                                                            |
| ----------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| `ARTIFACT_BUNDLE_INCOMPLETE` / missing manifest | Bad `--dbt-target` or missing `manifest.json` | Fix path; run `dbt` to emit artifacts.                                |
| Empty `results` / empty `matches`               | Query too strict or wrong project             | Loosen text or filters.                                               |
| Too many rows                                   | Over-broad query                              | Add `type:`, `package:`, or path filters; use `--limit`.              |
| Unknown option in script                        | CLI changed                                   | `dbt-tools schema search` / `dbt-tools schema discover` and `--help`. |

## Confirmed discovery against schema

```bash
dbt-tools schema
dbt-tools schema search
dbt-tools schema discover
dbt-tools search --help
dbt-tools discover --help
```
