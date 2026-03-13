---
name: version-bump
description: Interactively bump package version in root and package package.json files. Use when the user asks to bump version, increment version, update version, version bump, or set release version.
compatibility: Requires pnpm; project must have package.json at root and in packages.
---

# Version Bump

## Trigger scenarios

Activate this skill when the user says or implies:

- Bump version, bump up to version, increment version
- Update version, set version, release version
- Version bump, bump patch/minor/major

## Purpose

Interactively determine the target version, then update both the root and the package-level `package.json` files so versions stay in sync in this monorepo.

## Files to update

- **Root:** `package.json` (repository root)
- **Package:** `packages/dbt-artifacts-parser/package.json`

Both must be updated to the **same** version.

## Interactive workflow

1. **Read current versions:** Read `package.json` and `packages/dbt-artifacts-parser/package.json` and report the current `version` field from each.
2. **Ask the user:** If the user did not already specify a target version or increment type, ask:
   - Do you want a **specific version** (e.g. `0.2.0`), or a **semantic increment** (patch / minor / major)?
3. **Resolve target version:**
   - If the user gave a specific version (e.g. `0.2.0`): use that version. Validate it looks like semver (e.g. `x.y.z`). If invalid, ask again.
   - If the user chose an increment:
     - **Patch:** increment the third number (e.g. `0.1.4` → `0.1.5`).
     - **Minor:** increment the second number and set the third to `0` (e.g. `0.1.4` → `0.2.0`).
     - **Major:** increment the first number and set second and third to `0` (e.g. `0.1.4` → `1.0.0`).
4. **Apply updates:** Update the `"version"` field in both `package.json` and `packages/dbt-artifacts-parser/package.json` to the target version. Prefer a single search_replace per file (e.g. replace `"version": "0.1.4"` with `"version": "<target>"`).
5. **Verify:** Read both files and confirm the `version` field matches the intended value in each.

## Version calculation (increments)

Use the **current version from one of the package.json files** (they should match). Parse as major.minor.patch (integers only for this skill; ignore pre-release/build metadata for the increment math).

- **Patch:** `major.minor.(patch + 1)`
- **Minor:** `major.(minor + 1).0`
- **Major:** `(major + 1).0.0`

If the current version has fewer than three segments, treat missing segments as 0 (e.g. `0.1` → `0.1.0` for patch → `0.1.1`).

## Example

**User:** "Bump up to version."

**Agent:**

1. Reads root and package `package.json`; both show `"version": "0.1.4"`.
2. Asks: "Current version is 0.1.4. Do you want to set a specific version (e.g. 0.2.0) or bump by patch / minor / major?"
3. User: "Minor"
4. Agent computes new version: `0.2.0`, then updates both files:

```text
# In package.json and packages/dbt-artifacts-parser/package.json
"version": "0.1.4"  →  "version": "0.2.0"
```

5. Agent confirms: "Updated both package.json files to version 0.2.0."

## Other projects

If the repo has a different layout (e.g. single package or more packages), still read the existing `package.json` files, ask the user for target version or increment, compute the version, and update every `package.json` that should carry the same version. Prefer keeping all publishable or versioned packages in sync unless the user says otherwise.
