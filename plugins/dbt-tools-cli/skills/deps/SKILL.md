---
name: deps
description: >-
  Investigate upstream and downstream dependencies for a dbt resource with `dbt-tools deps` and a known or resolvable `unique_id`. Cover direction, depth, flat vs tree, and build-order style questions at a stable-pattern level.
compatibility: dbt-tools CLI on PATH. Requires the manifest (and the same `--dbt-target` / `DBT_TOOLS_DBT_TARGET` contract) as other graph commands. Suitable for any coding agent with shell access; pair with `discover`/`search` when the id is not yet known.
---
<!-- markdownlint-disable MD013 MD060 -->

# Resource dependencies (`deps`)

## Trigger scenarios

- The user asks **what depends on** a model, **what a model depends on**, or the **neighborhood** of a node in the dbt graph.
- You need a **depth-limited** or **build-order** view of upstream materialization for a single resource.
- You have a **definite `unique_id`** (or a string the CLI can validate as a resource id) and need dependency structure, not a search.

## Purpose

**`dbt-tools deps <resource-id>`** walks the manifest graph from a **single** node. Use it to answer **direction** (upstream vs downstream), **how far** to look (**depth**), how to **display** the result (**flat** list vs **tree**), and whether to order **upstream** nodes in **build** (topological) order when that mode is available.

This skill stays at **pattern** level. Exact flag names and defaults can change—use `dbt-tools schema deps` or `dbt-tools deps --help` when a script fails or you need the current schema.

## Inputs the agent should identify

- **`resource-id`**: a dbt **`unique_id`** (e.g. `model.project.table`) the user or a prior `search`/`discover` step provided. If you only have a **short name**, resolve it with **`discover`** or **`search`** first, or use **`explain`/`impact`** (see the **explain-impact** skill) if the intent is “resolve then summarize.”
- **Direction**: **downstream** (default for “who is affected?”) vs **upstream** (what this node depends on).
- **Depth**: full traversal vs **immediate neighbors** (depth `1` is the usual “one hop” mental model when supported).
- **Shape**: **tree** (nested) vs **flat** list; pick **flat** when you need a simple set for counting or follow-up.
- **Build order**: for **upstream** analysis, **build-order** style output (when the CLI offers it) helps match dbt’s dependency order for the subgraph.

## Recommended command pattern

1. **Default downstream, JSON for parsing:**

   `dbt-tools deps <resource-id> --dbt-target <root> --json`

2. **Upstream:**

   `dbt-tools deps <resource-id> --dbt-target <root> --direction upstream --json`

3. **One hop (typical for “direct” deps):**

   `dbt-tools deps <resource-id> --dbt-target <root> --depth 1 --json`

4. **Flat list instead of tree** (when the CLI supports `--format`):

   `dbt-tools deps <resource-id> --dbt-target <root> --format flat --json`

5. **Topological / build-style upstream ordering** (when you need “order to build or think about dependencies”):

   `dbt-tools deps <resource-id> --dbt-target <root> --direction upstream --build-order --json`

6. **Small payloads**: add **`--fields`** with the minimal set of properties you need (e.g. identifiers and names) once you know the field names from schema or a sample run.

Cheat sheet: [references/commands.md](references/commands.md).

## How to interpret results

- Read the JSON **structure** the CLI returns (tree vs flat): count nodes, list `unique_id`s, or present a human summary.
- **Direction**: confirm you queried the direction that matches the user’s “impact” vs “ingredients” question.
- **Depth**: a depth cap limits **hops**; omitting depth (when allowed) means “all reachable” per CLI defaults—**watch output size** and repeat with a smaller depth or **fields** filter if needed.

## Failure handling

- **Invalid or unknown `resource-id`**: validation or “not in graph” style errors—go back to **`discover`/`search`** (see the **discover-search** skill) or double-check the id from the manifest.
- **Missing manifest / target**: same as other artifact commands—fix `--dbt-target` or generate artifacts; use structured stderr with **`--json`** to propagate error codes to the user.
- **Overlarge output**: lower **depth**, switch to **flat**, or use **`--fields`** to reduce properties per node.

**Uncertain options?** `dbt-tools schema deps` and `dbt-tools deps --help`.

## Verification / completion criteria

- The user’s **dependency question** (direction, depth, and shape) is answered from **actual `deps` output** or a clear, cited error.
- The agent has **kept** JSON bounded when the graph is large (depth, fields, or a stated truncation strategy).
- The agent did **not** run `status` as a forced preflight; only if artifact presence was in doubt.

## Related (optional)

**`graph --focus`** (different command) can export a **subgraph** for visualization; use it when the user needs DOT/GEXF, not a CLI-first dependency list. The **discover-search** skill helps when the resource id is not yet known.
