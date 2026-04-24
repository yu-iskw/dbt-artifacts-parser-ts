---
name: discover-search
description: >-
  Find dbt resources by name, type, tag, package, path, or loose wording using `dbt-tools discover` and `dbt-tools search`. Resolve `unique_id` (and disambiguation) for follow-on CLI steps while remaining useful standalone.
compatibility: dbt-tools CLI on PATH. `discover` is **manifest-only** at `--dbt-target`. `search` follows the same artifact **root** as other standard commands, which in typical setups expects **`manifest.json` and `run_results.json` there**—use `dbt-tools schema` if your CLI version allows exceptions. Cross-editor agent workflows (Cursor, Windsurf, Claude, Codex) can follow the same patterns.
---

# Discover and search dbt resources

## Trigger scenarios

- The user names a model, test, or source by **short name**, **path fragment**, **tag**, or **package**, and you need a **definite dbt `unique_id`**.
- The user wants **candidates** for a fuzzy idea (“the orders model”, “something finance-tagged in core”).
- You are narrowing **one** resource before `deps`, `explain`, or `impact`—but this skill is complete on its own (you can stop at a ranked list and IDs).

## Purpose

- **`search`**: text and filter-oriented discovery, fast to reason about, **optional** `key:value` inline tokens in the query string.
- **`discover`**: **richer scoring**, reasons, disambiguation, and follow-up hooks in JSON when you need *explainable* resolution over the manifest.

Use **`--json`** when you must **parse** matches. Use **`--limit` / `--offset`** (where supported) to keep context small; prefer tighter queries first instead of huge pages.

## Inputs the agent should identify

- **Artifact root**: `--dbt-target` or `DBT_TOOLS_DBT_TARGET` (the user’s path or remote prefix is trusted—do not override without cause).
- **Query**: free text, or filter-only (for `discover`, you may use filters with an empty query when the CLI allows—see `--help` / `schema` if unsure).
- **Intent**: *explore* (broad list) vs *resolve one id* (tighten filters, read disambiguation).
- **Field budget**: for large projects, add **`--fields`** to shrink JSON once you know which fields you need (exact paths: `dbt-tools schema`).

## Recommended command pattern

1. **Text discovery with JSON (TTY-safe):**

   `dbt-tools search --dbt-target <root> "<query>" --json`

2. **Structured filters (example direction, not a full spec):**

   `dbt-tools search --dbt-target <root> --type model --tag <tag> --json`

3. **Explainable ranking / disambiguation:**

   `dbt-tools discover --dbt-target <root> "<query>" --json`

4. **Page when results may be long:**

   Add `--limit` / `--offset` when you need a slice; keep limits modest so the agent’s context stays bounded.

Patterns and when to pick `search` vs `discover`: [references/commands.md](references/commands.md).

## How to interpret results

- **`search` JSON**: use **`results`**, **`total`**, and match metadata to list candidates; the **`unique_id`** is the handle for `deps` / `explain` / `impact` when the user’s question needs that resource.
- **`discover` JSON**: read **`matches`**, **scores / reasons** (if present), **`disambiguation`**, and any **`next_actions` / `primitive_commands`**-style follow-ups the payload includes—treat as hints, not mandatory scripts.
- **Zero matches**: widen the query, drop a filter, or try alternate naming (e.g. package or path substring).
- **Many matches**: tighten filters, reduce `--limit` for a first pass, or read top-N only and ask a clarifying question.

## Failure handling

- **Artifact / bundle errors**: if stderr indicates missing manifest or bad target, report it; fix the target; do not invent resource IDs.
- **Ambiguity**: if multiple strong matches remain, return the top candidates and **distinct** `unique_id`s—do not guess.
- **Unknown flags**: the CLI surface may evolve—`dbt-tools schema search`, `dbt-tools schema discover`, and `dbt-tools <cmd> --help` are the source of truth (see [references/commands.md](references/commands.md)).

## Verification / completion criteria

- The user has a **defensible list** of candidate **`unique_id`** values, or a clear “none found / ambiguous” result with next steps.
- The agent has **kept output bounded** (reasonable `--limit` / `--fields` as appropriate) and used **`--json`** when machine parsing was required.
- The agent has **not** required a `status` preflight solely because this is discovery; only use `status` if readiness is in question (see the **`status`** skill in this plugin).

## Related (optional)

A **`deps`**-focused skill covers dependency direction and depth. An **`explain-impact`** skill covers `explain` / `impact` once a resource (or a short resolvable name) is chosen.
