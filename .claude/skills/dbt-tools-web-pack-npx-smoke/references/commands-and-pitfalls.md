# Pack + `npx` smoke — commands and pitfalls

## Why this workflow (short)

For end users, `@dbt-tools/web` ships as an npm tarball with `bin` → `dist-serve/server/cli.js`. Options considered:

| Approach                        | Fidelity | Cost   | Notes                                    |
| ------------------------------- | -------- | ------ | ---------------------------------------- |
| Tarball + `npx`                 | High     | Medium | Matches registry install semantics       |
| `npm install ./tgz` + bin       | High     | Medium | Extra install step                       |
| `npm link` / `pnpm link`        | Medium   | Low    | Differs from `npx` cache install         |
| `node dist-serve/server/cli.js` | Low      | Low    | Skips `files`, `bin`, dependency rewrite |
| Local Verdaccio + scoped `npx`  | Highest  | High   | Only when registry resolution must match |

**Chosen default:** pack with pnpm (rewrites `workspace:*`), then `npx` from an empty directory using `--package` for absolute tarball paths.

## Commands (repository root)

### Prerequisite: `dbt-artifacts-parser` `dist/`

`pnpm install` does not create `packages/dbt-artifacts-parser/dist`. Web `prepack` runs `@dbt-tools/core` `tsc`, which resolves `dbt-artifacts-parser/manifest` (and related subpaths) via package exports under `dist/`. Build the parser first (matches CI `web-pack-npx-smoke`), or run a full `pnpm build`:

```bash
pnpm --filter dbt-artifacts-parser build
```

### Pack

Pack (runs `prepack` → full `@dbt-tools/web` build):

```bash
pnpm --filter @dbt-tools/web pack
```

Produces **`dbt-tools-web-<version>.tgz` at the monorepo root** (gitignored `*.tgz`).

**Same smoke as CI** (resolves monorepo root via `REPO_ROOT`, first argument, or `git rev-parse`):

```bash
pnpm --filter @dbt-tools/web run smoke:npx-tgz
```

In GitHub Actions, `REPO_ROOT` is set to the workspace root before this script runs. Locally, omit `REPO_ROOT` if you run from inside the git checkout. Implementation: [`packages/dbt-tools/web/scripts/smoke-npx-packed-tarball.sh`](../../../../packages/dbt-tools/web/scripts/smoke-npx-packed-tarball.sh).

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
