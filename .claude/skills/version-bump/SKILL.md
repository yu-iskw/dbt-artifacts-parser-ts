---
name: version-bump
description: Interactively bump package versions for the parser package. Use when the user asks to bump version, increment version, set release version, or release dbt-artifacts-parser.
---

# Version bump

## Triggers

Use when the user asks to bump or set the version for this parser repository.

## Workflow

1. Ask for the target version or bump type (patch, minor, major) if it is not explicit.
2. Read the current versions in `package.json` and `packages/dbt-artifacts-parser/package.json`.
3. Update both files to the same target version.
4. Run `pnpm install --lockfile-only` to refresh `pnpm-lock.yaml`.
5. Verify with `pnpm build`, `pnpm test`, `pnpm lint:report`, `pnpm knip`, and `pnpm coverage:report`.

## Notes

Keep the parser release independent from downstream packages in other repositories.
