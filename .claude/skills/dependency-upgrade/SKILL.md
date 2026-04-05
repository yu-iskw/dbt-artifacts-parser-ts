---
name: dependency-upgrade
description: Upgrade outdated npm dependencies in the pnpm monorepo (recursive update, latest, targeted packages). Use when the user asks to upgrade dependencies, bump packages, refresh lockfile, pnpm update, outdated packages, latest versions, or dependency refresh—not monorepo release versions.
compatibility: Requires **pnpm** and **Node.js** matching [.node-version](../../../.node-version). Run all install/update commands from the **repository root** where `pnpm-workspace.yaml` and `pnpm-lock.yaml` live. Does not replace the **version-bump** skill for workspace package `"version"` fields.
---

# Dependency upgrade (pnpm workspace)

## Trigger scenarios

Activate when the user says or implies:

- Upgrade **dependencies**, **devDependencies**, **outdated** packages, or **refresh the lockfile**
- **pnpm update**, **bump npm packages**, **latest deps**, **get packages as new as possible**
- Upgrade **one dependency everywhere** it appears (e.g. `@aws-sdk/client-s3` across workspaces)
- **Security / advisory**-driven bumps (use updates + tests; do not claim CVE analysis without evidence)

## Not this skill

| Topic                                                                                              | Use instead                                 |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Bumping **`"version"`** in workspace `package.json` files (parser / `@dbt-tools/*` release semver) | [version-bump](../version-bump/SKILL.md)    |
| Editing **`workspace:*`** links                                                                    | Leave as-is unless adding/removing packages |

Dependencies live in **`dependencies`** / **`devDependencies`** / **`optionalDependencies`**. Release **package semver** is the `"version"` field—different workflow.

## Why tiered upgrades (short)

| Approach                                                                                | Feasibility | Risk        | Fit for agents                           | Score            |
| --------------------------------------------------------------------------------------- | ----------- | ----------- | ---------------------------------------- | ---------------- |
| **Tiered:** outdated → range update → targeted `@latest` → full `--latest` with consent | High        | Controlled  | Matches monorepo + CI                    | **92**           |
| **Only** `pnpm -r update --latest`                                                      | High        | High breaks | Poor default                             | 45               |
| **npm-check-updates** as primary                                                        | Medium      | Medium      | Second toolchain; pnpm is canonical here | 48               |
| **Manual edit every package.json**                                                      | Low         | High drift  | Error-prone                              | 35               |
| **Upgrade without lint/test/knip**                                                      | High        | Unknown     | Violates repo gates                      | **unacceptable** |

Default path: **inventory → conservative → targeted → aggressive only with explicit user OK.**

## Agent workflow

1. **Inventory (recommended):** From repo root, `pnpm outdated -r`. Optional: `pnpm outdated -r --long` if the installed pnpm supports it and the output helps triage.
2. **Conservative (safest default):** `pnpm -r update` — refreshes the lockfile within **existing** semver ranges in each `package.json`.
3. **Targeted “newest” for named packages:** `pnpm -r update <pkg>@latest` (e.g. `pnpm -r update @aws-sdk/client-s3@latest`) so every workspace that **declares** `<pkg>` moves to latest and `package.json` ranges update as pnpm applies. For a **single** workspace only: `pnpm --filter <workspace-name> add <pkg>@latest` (dev: `pnpm --filter <ws> add -D <pkg>@latest`).
4. **Aggressive (requires explicit user consent):** `pnpm -r update --latest` — may jump **majors** across the tree. State the risk; do not run without confirmation.

After **any** meaningful dependency or lockfile change:

- `pnpm lint:report`
- `pnpm coverage:report`
- `pnpm knip`

All three must **exit 0**. If SDKs, bundlers, TypeScript, or ESLint majors moved, also run **`pnpm build`** and, for web, **`pnpm --filter @dbt-tools/web build`** (or full root build script). See [AGENTS.md](../../../AGENTS.md) quality gates.

Full command notes, examples, and edge cases: [references/pnpm-upgrade-workflow.md](./references/pnpm-upgrade-workflow.md).
