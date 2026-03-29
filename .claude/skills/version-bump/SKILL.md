---
name: version-bump
description: Interactively bump package versions across the monorepo package.json files. Use when the user asks to bump version, bump all packages, sync versions across the monorepo, increment version, update version, version bump, set release version, or release dbt-tools / parser.
compatibility: Requires pnpm; workspace uses package.json at repo root and under packages/.
---

# Version Bump

## Trigger scenarios

Activate this skill when the user says or implies:

- Bump version, bump all packages, bump up to version, increment version
- Sync versions across the monorepo
- Update version, set version, release version
- Version bump, bump patch/minor/major
- Release `dbt-artifacts-parser`, release `@dbt-tools/*`, release dbt-tools

## Purpose

Interactively determine target version(s), then update every workspace `package.json` that carries a top-level `"version"` field. This monorepo may use **one unified semver** for all packages or **two release lines** (parser + root vs `@dbt-tools/*`); the agent must not assume versions already match across packages.

Internal workspace dependencies use `workspace:*`, so bumping `"version"` does **not** require editing dependency ranges for `@dbt-tools/*` or `dbt-artifacts-parser`.

## Files to update (this repository)

These paths each have a top-level `"version"` and are the default set to consider:

| Package                     | Path                                         |
| --------------------------- | -------------------------------------------- |
| (root workspace, `private`) | `package.json`                               |
| `dbt-artifacts-parser`      | `packages/dbt-artifacts-parser/package.json` |
| `@dbt-tools/core`           | `packages/dbt-tools/core/package.json`       |
| `@dbt-tools/cli`            | `packages/dbt-tools/cli/package.json`        |
| `@dbt-tools/web`            | `packages/dbt-tools/web/package.json`        |

Include the **root** `package.json` for consistency even though it is `private`. If new workspace packages are added, discover them with `packages/**/package.json` (exclude `node_modules`) and include any file that defines `"version"`.

## Interactive workflow

1. **Read and report a version matrix:** For each of the five paths above (plus any newly discovered `package.json` with `"version"`), read the file and list **package `name`**, **path**, and **`version`**. This makes split lines (e.g. parser at `0.2.0` and `@dbt-tools/*` at `0.1.0`) visible before changing anything.

2. **Bump strategy (if not already specified):** If the user only says “bump everything” or similar without choosing how to align versions, **ask** which model they want. Do **not** silently unify divergent lines.
   - **Unified:** One target semver applied to **all** listed `version` fields.
   - **Two lines:**
     - **Line A — parser + root:** `package.json` (root) and `packages/dbt-artifacts-parser/package.json` share one target version. Compute increments from **one** current version in this group (they should match; if not, call it out and ask which to follow or whether to unify this group).
     - **Line B — dbt-tools:** `packages/dbt-tools/core/package.json`, `packages/dbt-tools/cli/package.json`, and `packages/dbt-tools/web/package.json` share one target version. Compute increments from the **current** version shared by this group (again, flag mismatch if present).

3. **Resolve target version(s):** For each target the user needs (unified: one; two lines: one per line), either:
   - **Specific version:** Use the exact semver they gave (e.g. `0.2.0`). Validate shape (`x.y.z`). If invalid, ask again.
   - **Semantic increment** (patch / minor / major) from the appropriate **base version** for that line — see [Version calculation](#version-calculation-increments).

4. **Apply updates:** Update only the `"version"` fields in the files that belong to the chosen strategy. Prefer one search_replace per file (e.g. replace `"version": "0.1.4"` with `"version": "<target>"`).

5. **Verify:** Re-read every file that was edited and confirm each `"version"` matches the intended target for that package.

**Publish reminder:** When cutting npm releases, the `dbt-artifacts-parser` version usually needs to **already exist on npm** before publishing `@dbt-tools/*` if those packages depend on a published parser version after workspace rewrites. See [AGENTS.md](../../../AGENTS.md) for workflow pointers.

## Version calculation (increments)

For each bump target, use the **base version for that line** (unified: pick one representative or the user-specified single base; two lines: compute separately for parser+root vs `@dbt-tools/*`). Parse as `major.minor.patch` (integers only for this skill; ignore pre-release/build metadata for the increment math).

- **Patch:** `major.minor.(patch + 1)`
- **Minor:** `major.(minor + 1).0`
- **Major:** `(major + 1).0.0`

If the current version has fewer than three segments, treat missing segments as 0 (e.g. `0.1` → treat as `0.1.0` for patch → `0.1.1`).

## Examples

### Unified bump

**User:** "Bump everything with a minor bump, unified."

**Agent:** Reads all five `package.json` files, prints the matrix, confirms unified minor from the user-stated or agreed base (e.g. highest or a single version they choose), computes one new version (e.g. `0.2.0` → `0.3.0`), updates all five `"version"` fields, then verifies each file.

### Two-line bump

**User:** "Patch bump parser line and minor bump dbt-tools."

**Agent:** Reads the matrix; root + `dbt-artifacts-parser` are `0.2.0`, `@dbt-tools/*` are `0.1.0`. Computes Line A: patch → `0.2.1` for root and `packages/dbt-artifacts-parser/package.json`. Computes Line B: minor from `0.1.0` → `0.2.0` for the three `packages/dbt-tools/*/package.json` files. Applies and verifies only those files.

## Layout changes

If the monorepo layout changes, rediscover `package.json` files under `packages/` (and the root) as above instead of relying on a stale path list.
