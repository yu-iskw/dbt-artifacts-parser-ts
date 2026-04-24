---
name: discover-search
description: Find dbt resources by name, type, tag, package, path, or fuzzy user wording and resolve candidate unique_ids for later investigation.
compatibility: dbt-tools CLI on PATH; works with manifest-backed targets.
---

# discover-search

## Trigger scenarios

Activate this skill when the user asks to:

- find a model/test/source by approximate wording,
- list resources matching tags, package, type, or path,
- identify likely `unique_id` values before running dependency or impact analysis.

## Purpose

Use `dbt-tools discover` and/or `dbt-tools search` to map user language into concrete dbt resources.

The usual output of this skill is a short, ranked candidate set with one or more `unique_id` values.

## Inputs the agent should identify

- `--dbt-target` location (or a confirmed target environment variable).
- User constraints: name fragments, resource type, tags, package, path, domain wording.
- Whether the user wants one best match or multiple candidates.
- Need for machine-readable parsing (`--json` preferred).

## Recommended command pattern

Start with JSON output and narrow quickly:

```bash
dbt-tools discover --dbt-target <target> --json
```

or

```bash
dbt-tools search <query> --dbt-target <target> --json
```

Then apply high-level output bounds (`--limit`, optional `--fields`) to keep context small.

For compact recipes and branch guidance, see [references/commands.md](references/commands.md).

## How to interpret results

- Prioritize exact/strong matches to user constraints.
- Extract `unique_id` for each top candidate.
- If multiple plausible matches remain, present a short disambiguation list.
- If no matches, suggest constraint relaxation (broader query, fewer filters, different target).

## Failure handling

- Missing artifacts/manifest: pause discovery and ask for a correct artifact target.
- Zero matches: broaden search terms and remove overly strict filters.
- Ambiguous results: ask the user to choose among top candidates or refine constraints.
- Option mismatch or renamed commands: inspect `dbt-tools schema` and per-command `--help`.

## Verification / completion criteria

Consider this skill complete when the agent has:

1. Run discovery/search with user-relevant constraints.
2. Produced at least one candidate `unique_id` (or clearly explained zero results).
3. Returned a concise shortlist ready for follow-up commands.
4. Documented the next action (for example `deps`, `explain`, or `impact`) for the chosen resource.
