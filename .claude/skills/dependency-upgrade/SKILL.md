---
name: dependency-upgrade
description: Upgrade outdated npm dependencies in the pnpm monorepo (recursive update, latest, targeted packages) and discover vulnerable dependencies via audit plus advisory-backed bumps. Use when the user asks to upgrade dependencies, bump packages, refresh lockfile, pnpm update, outdated packages, latest versions, dependency refresh, security vulnerabilities, pnpm audit, Dependabot-style advisories, GHSA/CVE-driven updates—not monorepo release versions.
compatibility: Requires **pnpm** and **Node.js** matching [.node-version](../../../.node-version). Run all install/update commands from the **repository root** where `pnpm-workspace.yaml` and `pnpm-lock.yaml` live. Does not replace the **version-bump** skill for workspace package `"version"` fields.
---

# Dependency upgrade (pnpm workspace)

## Trigger scenarios

Activate when the user says or implies:

- Upgrade **dependencies**, **devDependencies**, **outdated** packages, or **refresh the lockfile**
- **pnpm update**, **bump npm packages**, **latest deps**, **get packages as new as possible**
- Upgrade **one dependency everywhere** it appears (e.g. `@aws-sdk/client-s3` across workspaces)
- **Advisory-backed bumps:** find vulnerable packages, confirm **patched versions** from the official advisory (GHSA/CVE/npm/GitHub Security), then apply **targeted** upgrades (see **Vulnerable dependencies** below)
- **Audit / vulnerability scan:** run **`pnpm audit`** and triage; reconcile with GitHub Dependabot or user-supplied GHSA/CVE IDs when given

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
| **Audit-first security:** `pnpm audit` → advisory → targeted patched version            | High        | Controlled  | Same gates as other lockfile changes     | **94**           |
| **Only** `pnpm -r update --latest`                                                      | High        | High breaks | Poor default                             | 45               |
| **npm-check-updates** as primary                                                        | Medium      | Medium      | Second toolchain; pnpm is canonical here | 48               |
| **Manual edit every package.json**                                                      | Low         | High drift  | Error-prone                              | 35               |
| **Upgrade without lint/test/knip**                                                      | High        | Unknown     | Violates repo gates                      | **unacceptable** |

Default path: **inventory → conservative → targeted → aggressive only with explicit user OK.**

For **security-only** work, use **audit → advisory verification → targeted update → same post-change quality gates** (do not skip lint/coverage/knip because the change is “only” a patch bump).

## Vulnerable dependencies (audit + advisories)

**Goal:** Surface packages in **`pnpm-lock.yaml`** that scanners flag as vulnerable, then move to a **documented patched** release—not only “newer” per semver.

### Discovery (run from repo root)

1. **`pnpm audit`** — primary signal for this repo (lockfile / npm advisory data). Exit code may be non-zero when findings exist; still capture the report.
2. Optional machine-readable: **`pnpm audit --json`** when parsing or summarizing many findings (pnpm version-dependent; fall back to plain **`pnpm audit`** if unsupported).
3. **`pnpm why <package>`** — after a finding names a package, show **which workspace(s)** and **why** it is installed (direct vs transitive). Use **`pnpm --filter <workspace> why <package>`** to narrow to one package.
4. **`pnpm outdated -r` is not a CVE scanner** — it shows newer versions, not security findings. Run **`pnpm audit`** explicitly when the user cares about vulnerabilities.

### Interpretation rules

- **Name the evidence:** cite **GHSA id**, **CVE id**, or the **npm/GitHub advisory URL** when stating a vulnerability or patched version. Do not invent severities or fixed versions.
- **Prefer upstream “Patched versions” / “Fixed in”** from the advisory over guesswork. If the advisory lists a minimum fixed version (e.g. `vite@8.0.5`), plan **`pnpm -r update <pkg>@<patched>`** or **`pnpm --filter <ws> add -D <pkg>@<patched>`** as appropriate.
- **GitHub vs local:** Dependabot alerts can lag or target another branch; **`pnpm audit` on the branch you are editing** is the ground truth for whether the lockfile still resolves a vulnerable range.
- **Transitive deps:** fix by **bumping a parent** that pulls a patched release when possible; use **`pnpm.overrides`** in root [`package.json`](../../../package.json) only when unavoidable—document why and prefer removing the override once upstream ships a fix (narrow scope; avoid permanent noise).

### Remediation (after identifying patched versions)

Use the same **targeted** commands as general upgrades:

- Everywhere declared: **`pnpm -r update <pkg>@latest`** only if **npm `latest`** is ≥ the advisory’s patched version; otherwise use an explicit version (e.g. **`pnpm -r update vite@8.0.5`**) or widen the declaring workspace’s range (e.g. **`^8.0.5`**) and run **`pnpm -r update`**.
- Single workspace: **`pnpm --filter <name> add <pkg>@<version>`** (`-D` for devDependencies).

Then ensure **`pnpm-lock.yaml`** reflects the fix and run the **quality gates** below.

### Optional automation caveat

- **`pnpm audit --fix`** (if available in your pnpm version) may apply broad lockfile changes; review the diff like an aggressive upgrade and re-run gates. Prefer **explicit targeted** updates when the user named specific advisories.

Full audit-oriented commands: [references/pnpm-upgrade-workflow.md](./references/pnpm-upgrade-workflow.md#vulnerability-audit-pnpm).

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

After **security-driven** lockfile changes, use the **same** verification steps as other upgrades.

Full command notes, examples, and edge cases: [references/pnpm-upgrade-workflow.md](./references/pnpm-upgrade-workflow.md).
