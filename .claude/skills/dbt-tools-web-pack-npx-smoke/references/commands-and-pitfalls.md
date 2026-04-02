# Pack + `npx` smoke — commands and pitfalls

## Why this workflow (short)

For end users, `@dbt-tools/web` ships as an npm tarball with `bin` → `dist-serve/server/cli.js`. Options considered:

| Approach                        | Fidelity | Cost   | Notes                                          |
| ------------------------------- | -------- | ------ | ---------------------------------------------- |
| Tarball + `npx`                 | High     | Medium | Matches registry install semantics             |
| `npm install ./tgz` + bin       | High     | Medium | Extra install step                             |
| `npm link` / `pnpm link`        | Medium   | Low    | Differs from `npx` cache install               |
| `node dist-serve/server/cli.js` | Low      | Low    | Skips `files`, `bin`, dependency rewrite       |
| Local Verdaccio + scoped `npx`  | Highest  | High   | CI uses this; matches full registry resolution |

**CI default:** [`scripts/smoke-npx-with-verdaccio.sh`](../../../../scripts/smoke-npx-with-verdaccio.sh) — ephemeral Verdaccio, explicit `pnpm --filter dbt-artifacts-parser run build` (so `dist/` exists before any publish/pack), then `pnpm publish` for `dbt-artifacts-parser` → `@dbt-tools/core` → `@dbt-tools/web`, then pack + `npx` with `NPM_CONFIG_REGISTRY` (see [.github/workflows/test.yml](../../../../.github/workflows/test.yml) job `web-pack-npx-smoke`).

**Manual default:** pack with pnpm (rewrites `workspace:*`), then `npx` from an empty directory using `--package` for absolute tarball paths — only works without extra setup if **`dbt-artifacts-parser` and `@dbt-tools/core` at that version already exist on the public registry**; otherwise use the Verdaccio script below.

## Commands (repository root)

### Same as CI: Verdaccio + publish + pack + `npx`

After `pnpm install`, from the repo root (optional `REPO_ROOT` if not in a git checkout):

```bash
bash scripts/smoke-npx-with-verdaccio.sh
```

Uses [`scripts/verdaccio-smoke.yaml`](../../../../scripts/verdaccio-smoke.yaml) and a temp npmrc with a placeholder `_authToken` (npm 10+ requires a token for `publish`; Verdaccio accepts it with `publish: $all`). **Do not set `NPM_CONFIG_USERCONFIG` before `npx verdaccio`** starts, or `npx` may try to fetch Verdaccio from localhost. The script **builds the parser before publish**; you do not need a separate parser build step for this path.

### Prerequisite: `dbt-artifacts-parser` `dist/` (manual pack path only)

`pnpm install` does not create `packages/dbt-artifacts-parser/dist`. Web `prepack` runs `@dbt-tools/core` `tsc`, which resolves `dbt-artifacts-parser/manifest` (and related subpaths) via package exports under `dist/`. The Verdaccio script above handles this automatically; for **manual** `pnpm --filter @dbt-tools/web pack` only, build the parser first, or run a full `pnpm build`:

```bash
pnpm --filter dbt-artifacts-parser build
```

### Pack (manual path)

Pack (runs `prepack` → full `@dbt-tools/web` build):

```bash
pnpm --filter @dbt-tools/web pack
```

Produces **`dbt-tools-web-<version>.tgz` at the monorepo root** (gitignored `*.tgz`).

**Tarball-only smoke** (expects peers on the active registry; set `NPM_CONFIG_REGISTRY` to a Verdaccio URL if you published there first):

```bash
pnpm --filter @dbt-tools/web run smoke:npx-tgz
```

Resolves monorepo root via `REPO_ROOT`, first argument to [`smoke-npx-packed-tarball.sh`](../../../../packages/dbt-tools/web/scripts/smoke-npx-packed-tarball.sh), or `git rev-parse`. In GitHub Actions, `REPO_ROOT` is the workspace root.

Smoke **help** from a clean directory (no monorepo `node_modules` on `PATH`):

```bash
TGZ="$PWD/dbt-tools-web-0.4.1.tgz"   # adjust version
cd "$(mktemp -d)"
npx -y --package="$TGZ" -- dbt-tools-web --help
```

Relative tarball in the same directory as the file:

```bash
cd "$(mktemp -d)"
cp "$REPO_ROOT/dbt-tools-web-0.4.1.tgz" .
npx -y ./dbt-tools-web-0.4.1.tgz -- --help
```

## Pitfalls

- **`npm error notarget` / `No matching version found for @dbt-tools/core@…`:** the packed web tarball lists concrete semver peers (rewritten from `workspace:*`). A clean-dir `npx` install hits the **registry** for those peers. Use **`bash scripts/smoke-npx-with-verdaccio.sh`** (or publish peers to npm first).
- **Bare absolute path to `.tgz` as first `npx` argument** (e.g. `npx -y /abs/path/file.tgz -- --help`) can yield **`Permission denied`** — the shell tries to execute the archive. Use **`--package=/abs/path/...`** + **`-- dbt-tools-web`**, or a **relative** `./file.tgz`.
- **`npm pack` without pnpm** in this monorepo can mishandle **`workspace:*`** dependencies; prefer **`pnpm --filter @dbt-tools/web pack`**.

## Optional HTTP check

With a directory containing `manifest.json` and `run_results.json`:

```bash
# Example fixture dirs exist under packages/dbt-artifacts-parser/resources/ (split paths;
# copy manifest + run_results of the same version into one temp dir for --target.)
npx -y --package="$TGZ" -- dbt-tools-web --target "$ARTIFACT_DIR" --no-open --port 8765 &
# curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8765/
```

## Pointers

- Package README: [packages/dbt-tools/web/README.md](../../../../packages/dbt-tools/web/README.md) — **Verify publish locally**.
- CI: [.github/workflows/test.yml](../../../../.github/workflows/test.yml) — job `web-pack-npx-smoke`.
