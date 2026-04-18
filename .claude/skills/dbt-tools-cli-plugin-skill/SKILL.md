---
name: dbt-tools-cli-plugin-skill
description: Author a new agent skill under plugins/dbt-tools-cli/skills for @dbt-tools/cli; layout, plugin README index, and structural verification.
compatibility: Repository dbt-artifacts-parser-ts; skills under plugins/dbt-tools-cli/skills/.
---

# dbt-tools-cli plugin skill (authoring)

## Triggers

Use this skill when the user asks or implies:

- Add, scaffold, or document a **new skill** for **`@dbt-tools/cli`** / `dbt-tools`
- Extend **`plugins/dbt-tools-cli/skills/`** with another workflow
- Make plugin skills **pass** repo verification or align with **ADR-0007** layout

This is a **meta-skill** (how to add plugin skills). It does not replace the CLI reference in [`packages/dbt-tools/cli/README.md`](../../../packages/dbt-tools/cli/README.md).

## What you are adding

**Plugin skills** live here:

- `plugins/dbt-tools-cli/skills/<kebab-case-id>/SKILL.md`

They ship with the **dbt-tools-cli** agent plugin ([`plugins/dbt-tools-cli/`](../../../plugins/dbt-tools-cli/)). Per-engine manifests already set `skills` to `./skills/`—**you do not edit** `.codex-plugin`, `.cursor-plugin`, or `.claude-plugin` just to add another subdirectory skill.

**Do not** add or edit **marketplace** entries ([`.agents/plugins/marketplace.json`](../../../.agents/plugins/marketplace.json), [`.cursor-plugin/marketplace.json`](../../../.cursor-plugin/marketplace.json)) for a new skill inside an **existing** plugin; marketplaces list **plugins**, not individual skills.

## Authoring steps

1. **Pick an id** — kebab-case folder name (e.g. `my-workflow`). Use the **same** string for YAML **`name:`** in `SKILL.md`. Avoid clashing with existing skills (for example [`dbt-artifacts-status`](../../../plugins/dbt-tools-cli/skills/dbt-artifacts-status/SKILL.md)).

2. **Create** `plugins/dbt-tools-cli/skills/<id>/SKILL.md` with frontmatter and body (see skeleton below).

3. **Content rules**
   - **Triggers** and **when to use** — help agents discover the skill.
   - **Commands** — link to [`packages/dbt-tools/cli/README.md`](../../../packages/dbt-tools/cli/README.md) for flags and options; prefer `dbt-tools schema` for discovery and `--json` where appropriate.
   - **Workflow order** — e.g. artifact check → search → deps; do not paste the full CLI reference.
   - **Artifact readiness** — if the workflow needs `manifest.json` / `run_results.json`, point to or compose with [`dbt-artifacts-status`](../../../plugins/dbt-tools-cli/skills/dbt-artifacts-status/SKILL.md) instead of duplicating readiness rules.
   - **Progressive disclosure** — long tables in `references/` under the same skill directory (see exemplar [`references/readiness.md`](../../../plugins/dbt-tools-cli/skills/dbt-artifacts-status/references/readiness.md)).

4. **Link depth** — From `plugins/dbt-tools-cli/skills/<id>/SKILL.md`, the repo root is **four** levels up (`../../../../`). Example: `../../../../packages/dbt-tools/cli/README.md` for flags and extended topics.

5. **Index** — Add a row to [`plugins/dbt-tools-cli/README.md`](../../../plugins/dbt-tools-cli/README.md) skills table with a link to `skills/<id>/SKILL.md` and a short purpose.

6. **Verify** — From repository root:

```bash
./plugins/tests/verify-agent-plugins.sh structural
pnpm lint:report
pnpm coverage:report
pnpm knip
```

Structural rules and ADR pointer: [references/layout-and-verification.md](references/layout-and-verification.md).

## Skeleton for a new plugin skill

Use as a starting point (replace `my-workflow` and fill sections):

```yaml
---
name: my-workflow
description: One or two sentences for agent discovery; mention dbt-tools and the task.
---

# My workflow

## When to use

## Commands

Link to [packages/dbt-tools/cli/README.md](../../../../packages/dbt-tools/cli/README.md) for flags; prefer `dbt-tools schema` and `--json` where appropriate.

## Related

- [packages/dbt-tools/cli/README.md](../../../../packages/dbt-tools/cli/README.md) — Field Filtering, Input Validation, Error handling, Automation
```

**README table row** example:

```markdown
| [`my-workflow`](skills/my-workflow/SKILL.md) | Short purpose line. |
```

## Related

- Plugin discovery (end users): [`plugins/README.md`](../../../plugins/README.md)
- Verification and CI (contributors): [`plugins/CONTRIBUTING.md`](../../../plugins/CONTRIBUTING.md)
- Exemplar skill: [`dbt-artifacts-status`](../../../plugins/dbt-tools-cli/skills/dbt-artifacts-status/SKILL.md)
