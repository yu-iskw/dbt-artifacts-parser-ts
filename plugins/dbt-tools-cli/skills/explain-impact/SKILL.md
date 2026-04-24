---
name: explain-impact
description: >-
  Summarize a dbt resource and reason about dependency impact with `dbt-tools explain` and `dbt-tools impact`. Use when the user wants a narrative or JSON snapshot of “what is this node?” and “what does it affect?”; defer exact flags to `schema` or `--help` when the CLI changes.
compatibility: dbt-tools CLI on PATH. Both intents read the same artifact root as other manifest commands; they **resolve** short or ambiguous names via the CLI’s own discovery path (see command descriptions in `dbt-tools schema`). Works across IDE and headless agents; prefer `--json` for machine parsing.
---
<!-- markdownlint-disable MD013 MD060 -->

# Explain and impact a resource

## Trigger scenarios

- The user wants a **structured summary** of a dbt node (what it is, where it lives, how it maps in the project).
- The user wants an **impact-style** read: **who depends on this**, **how large** the blast radius feels, or **notable** downstreams—without hand-walking the full graph.
- You already have a **name or id** (possibly short) and need **artifact-grounded** JSON to cite back.

## Purpose

- **`explain`**: **summary / resolution** intent—turn a user’s resource reference into a **manifest-backed** view (the CLI may combine discover-like resolution with manifest fields). Use for “**what is this?**”
- **`impact`**: **dependency impact** intent—snapshot of how the node sits in the graph for “**what does this affect?**” and related metrics the CLI exposes.

**Stability note:** the CLI is **intentionally** described at workflow level here. If an option, field name, or sub-object moves between releases, use **`dbt-tools schema explain`**, **`dbt-tools schema impact`**, or **`dbt-tools <command> --help`**—do not treat this skill as a full spec.

## Inputs the agent should identify

- **Resource reference**: `unique_id` is ideal; a **short name** may work because the commands **resolve** via discover-style logic—still verify the resolved id in JSON before answering as fact.
- **Artifact root**: `--dbt-target` or `DBT_TOOLS_DBT_TARGET` (trust the user’s value when provided).
- **Field budget**: use **`--fields`** only when you need a **small** slice and you know valid paths—otherwise take full JSON for correctness, then summarize in natural language.
- **Debug / narrative**: if **`--trace`** is available, it can add a short **transcript** to JSON for “how we got here”—use when debugging odd resolution, not for every call.

## Recommended command pattern

1. **Summary intent (with JSON):**

   `dbt-tools explain <resource> --dbt-target <root> --json`

2. **Impact intent (with JSON):**

   `dbt-tools impact <resource> --dbt-target <root> --json`

3. **When the exact flag set is unknown or a command 404s**: run `dbt-tools schema` to see whether the command is registered, then `dbt-tools schema explain` / `dbt-tools schema impact`.

4. **Narrowing large JSON** (only after a successful full response or schema confirmation): add **`--fields`** with paths the schema documents.

5. **Optional follow-on**: for **pure dependency tree** or **build-order** questions, prefer **`deps`**; for “find the right id” first, prefer **`search` / `discover`**.

Command recipes and failure modes: [references/commands.md](references/commands.md).

## How to interpret results

- Parse the **top-level JSON** fields the CLI returns: expect identifiers (**`unique_id`**), **human labels**, and command-specific **impact** or **explanation** sections. Exact keys differ by version—treat the payload as the authority.
- If the payload includes **`web_url` / `review_url`** (when a web base URL is configured in the environment), you may pass these to the user for UI review; do not assume they are always present.
- **Disambiguation** or **low confidence** in resolution: do not overstate a match—return candidates or ask a clarifying question; cross-check with **`discover`/`search`** if the explain/impact output is ambiguous.

## Failure handling

- **Command missing** on an older `dbt-tools` binary: `dbt-tools schema` will not list it—say the install is too old, or the command was renamed; avoid fabricating subcommands.
- **Resolution failed or ambiguous**: narrow with **`discover`/`search`**, or pass a full **`unique_id`**.
- **Artifact / validation errors**: mirror structured stderr to the user; fix `dbt-target` or regenerate artifacts.
- **Unsupported option in your script**: refresh from **`schema`**, not from this skill’s prose.

## Verification / completion criteria

- The user gets a **coherent** answer: what the resource is (**explain**) and/or what its **impact** looks like (**impact**), grounded in **command JSON** (or a clear, cited error).
- The agent has **named** the resolved **`unique_id`** when the user’s input was ambiguous and resolution succeeded.
- The agent has **not** required unrelated prefetches (`status` only if readiness is genuinely unknown).

## Related (optional)

**`deps`** offers graph traversal and layout control when you need explicit **upstream/downstream** and **depth** walks. **Discover-search** is for when you lack a node handle entirely.
