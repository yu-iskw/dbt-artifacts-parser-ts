---
name: explain-impact
description: Explain a selected dbt resource and reason about downstream impact using dbt-tools explain/impact workflows.
compatibility: dbt-tools CLI on PATH; command availability may vary by version.
---

# explain-impact

## Trigger scenarios

Activate this skill when the user asks:

- what a specific resource does,
- what would be affected by changing a resource,
- how to communicate likely blast radius to stakeholders,
- for a concise evidence-based explanation before making changes.

## Purpose

Use `dbt-tools explain` and `dbt-tools impact` (when available) to convert a selected `unique_id` into a practical explanation and impact summary.

Because CLI surfaces evolve, treat command discovery as part of the workflow when option names are uncertain.

## Inputs the agent should identify

- Selected resource `unique_id`.
- Target artifact location (`--dbt-target` or environment variable).
- User intent: descriptive explanation, change impact, or both.
- Preferred output mode (`--json` for parsing and structured reporting).

## Recommended command pattern

Start with command availability checks when uncertain:

```bash
dbt-tools schema
```

Then run the relevant command(s), preferring JSON:

```bash
dbt-tools explain <unique_id> --dbt-target <target> --json

dbt-tools impact <unique_id> --dbt-target <target> --json
```

If syntax differs in the installed version, check `dbt-tools <command> --help` before retrying.

For lightweight recipes and fallback branches, see [references/commands.md](references/commands.md).

## How to interpret results

- For `explain`: summarize resource role, context, and notable metadata.
- For `impact`: summarize likely downstream affected nodes and practical blast-radius tiers.
- Separate high-confidence CLI evidence from agent inference.
- Keep outputs bounded and focused on the user’s decision.

## Failure handling

- Command missing or renamed: verify with `dbt-tools schema` and per-command help.
- Invalid resource id: resolve a valid id with discovery/search, then rerun.
- Missing artifacts: surface what is missing and request correct target artifacts.
- Large result sets: use high-level field/limit controls where available and summarize top impact areas.

## Verification / completion criteria

Consider this skill complete when the agent has:

1. Confirmed command availability (if needed) via `schema` or `--help`.
2. Run `explain` and/or `impact` for the selected resource.
3. Returned a concise explanation and impact summary grounded in CLI output.
4. Provided clear next steps (for example deeper `deps` traversal, validation run, or rollout caution).
