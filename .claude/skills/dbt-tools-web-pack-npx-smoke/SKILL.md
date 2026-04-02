---
name: dbt-tools-web-pack-npx-smoke
description: Pack @dbt-tools/web to a tarball and smoke-test the published dbt-tools-web CLI via npx without npm publish. Use when verifying the npm distribution, pre-release checks, bin/dist-serve layout, or fixing pack/npx failures for the web package.
compatibility: Requires pnpm and Node as in repo .node-version; npx (npm). Run from repository root unless noted.
---

# @dbt-tools/web pack + `npx` smoke

## Trigger scenarios

Use this skill when the user or task implies:

- Verify **packed** / **published-shaped** **`@dbt-tools/web`** (tarball, `bin`, `dist` + `dist-serve`)
- Smoke-test **`dbt-tools-web`** via **`npx`** **without publishing** to the registry
- Debug **`npx`** + local **`.tgz`** failures (**`Permission denied`**, missing `dist-serve`, wrong deps in tarball)
- Pre-release or **CI parity** with the **`web-pack-npx-smoke`** workflow

Do **not** substitute this for **Playwright E2E** (`pnpm test:e2e`) or full **UI** regression; use **`dbt-tools-web-e2e-fix`** for browser E2E.

## Purpose

Ensure the **npm pack** artifact installs and exposes the **`dbt-tools-web`** binary correctly. This catches mistakes in **`package.json` `bin`**, **`files`**, **`prepack` build**, and **workspace dependency rewriting** that unit tests and Vite dev do not cover.

## Commands (summary)

From the **repository root**:

1. `pnpm --filter @dbt-tools/web pack` — creates `dbt-tools-web-<version>.tgz` at the **repo root** (`prepack` runs the full web build).
2. In a **fresh temp directory**, run **`npx -y --package="$TGZ" -- dbt-tools-web --help`** (use absolute `TGZ`; see pitfalls below), or run **`pnpm --filter @dbt-tools/web run smoke:npx-tgz`** after pack (uses [`scripts/smoke-npx-packed-tarball.sh`](../../../packages/dbt-tools/web/scripts/smoke-npx-packed-tarball.sh)).

Details, optional HTTP smoke, and the **absolute-path `npx` pitfall** are in [references/commands-and-pitfalls.md](references/commands-and-pitfalls.md).

## Verification loop

1. **Pack:** `pnpm --filter @dbt-tools/web pack` (must exit 0).
2. **Resolve tarball:** exactly one `dbt-tools-web-*.tgz` at repo root (version matches [packages/dbt-tools/web/package.json](../../../packages/dbt-tools/web/package.json)).
3. **Smoke:** `cd "$(mktemp -d)"` then `npx -y --package="<absolute-path-to-tgz>" -- dbt-tools-web --help` (must print usage and exit 0).
4. **On failure:** read stderr (missing file, Node errors, `command not found`). Fix **web `package.json`**, **Vite server build** (`vite.server.config.ts`), **prepack/build scripts**, or **workspace publish** config; re-run from step 1.

**Note:** `pack` triggers **`prepack`** and may **rebuild** the web package even after `pnpm build`; that is expected and matches publish behavior.

## Related skills and docs

- **Playwright E2E:** [`dbt-tools-web-e2e-fix`](../dbt-tools-web-e2e-fix/SKILL.md)
- **Monorepo build errors:** [`build-fix`](../build-fix/SKILL.md)
- **End-user README:** [packages/dbt-tools/web/README.md](../../../packages/dbt-tools/web/README.md)

## Verifier agent

When invoked as part of **verification**, run this smoke **after `pnpm build` succeeds** so TypeScript/Vite issues are caught first. Report whether **pack** and **`npx … --help`** passed.
