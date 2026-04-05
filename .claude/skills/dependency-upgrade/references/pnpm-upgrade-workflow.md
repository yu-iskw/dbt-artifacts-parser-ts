# pnpm upgrade workflow (monorepo)

Operate from the **repository root** so **`pnpm-lock.yaml`** is updated consistently.

## Command overview

| Goal                                         | Command (root)                          | Effect                                                                                               |
| -------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| See outdated deps                            | `pnpm outdated -r`                      | Lists newer versions vs lockfile / ranges for all workspace packages.                                |
| Longer outdated view                         | `pnpm outdated -r --long`               | More columns if supported by your pnpm version.                                                      |
| Update within current ranges                 | `pnpm -r update`                        | Bumps **lockfile** (and installs) to latest versions allowed by each **`package.json`** range.       |
| One dependency to latest everywhere declared | `pnpm -r update <pkg>@latest`           | Example: `pnpm -r update @aws-sdk/client-s3@latest`.                                                 |
| Single workspace package only                | `pnpm --filter <name> add <pkg>@latest` | Example: `pnpm --filter @dbt-tools/web add @aws-sdk/client-s3@latest`. Use `-D` for devDependencies. |
| **All** deps to latest (risky)               | `pnpm -r update --latest`               | May upgrade **majors**; requires explicit maintainer approval before running in automation.          |

`-r` / `--recursive` applies the command to **all workspace packages** that participate in the operation (for `update`, packages that list the dependency; for bare `pnpm -r update`, all packages get their ranges honored).

## Examples

```bash
# 1) What is stale?
pnpm outdated -r

# 2) Safe refresh: honor existing ^ and ~ in every package.json
pnpm -r update

# 3) Push one library to latest across the whole workspace
pnpm -r update @aws-sdk/client-s3@latest

# 4) Only @dbt-tools/web, production dependency
pnpm --filter @dbt-tools/web add react@latest
```

## Lockfile and install

- After `update` / `add`, commit **`pnpm-lock.yaml`** together with any **`package.json`** changes.
- Prefer **`pnpm install`** only when adding new deps or fixing a corrupted store; **`pnpm -r update`** already performs resolution.

## Edge cases

- **Merge conflicts** in `pnpm-lock.yaml`: resolve by choosing one side or regenerating (`pnpm install` after fixing `package.json`); verify with `pnpm install` exit 0.
- **`workspace:*`**: internal links stay on `workspace:*`; upgrading **does not** replace them with semver—do not “fix” workspace protocols during dependency bumps.
- **`pnpm dedupe`**: optional follow-up in pnpm 8+ to reduce duplication after large merges; run only if helpful and re-verify install/tests.
- **Optional tooling:** `npx npm-check-updates` can list desired versions but this repo’s **authoritative** flow is **pnpm**; prefer pnpm commands above for lockfile consistency.

## Verification (this repository)

From repo root after upgrades:

1. `pnpm lint:report` (must exit 0)
2. `pnpm coverage:report` (must exit 0; if coverage thresholds fail, add or adjust tests)
3. `pnpm knip` (must exit 0)

If web/tooling changed materially: `pnpm build` and/or `pnpm --filter @dbt-tools/web build`. E2E: `pnpm test:e2e` when UI or preview flows may break.

See [AGENTS.md](../../../../AGENTS.md) for full project context.
