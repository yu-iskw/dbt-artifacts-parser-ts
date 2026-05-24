# dbt-artifacts-parser

TypeScript parser and generated type package for dbt artifact JSON files.

## Package

- [`packages/dbt-artifacts-parser`](packages/dbt-artifacts-parser) publishes `dbt-artifacts-parser`.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint:report
pnpm knip
pnpm coverage:report
```

### Trunk (lint and format)

This repo uses [Trunk](https://github.com/trunk-io/docs/blob/main/code-quality/overview/cli/getting-started/install.md) for shared checks (markdown, YAML, workflows, security scanners, and more). Install it as a Node dev dependency via the official launcher—not the unrelated npm package `trunk`:

```bash
pnpm add -D @trunkio/launcher
```

`pnpm install` already installs `@trunkio/launcher`, which provides the `trunk` command. The CLI version is pinned in [`.trunk/trunk.yaml`](.trunk/trunk.yaml) and downloaded on first use.

```bash
pnpm exec trunk version
pnpm lint:trunk    # trunk check -y
pnpm format:trunk  # trunk fmt
```

Full local lint/format runs Trunk first, then ESLint, Prettier, and Knip: `pnpm lint`, `pnpm format`. If Trunk cannot run, use `pnpm lint:without-trunk` and `pnpm format:without-trunk`.

## Type generation

Parser schemas and generated sources live under [`packages/dbt-artifacts-parser`](packages/dbt-artifacts-parser). Use [`.claude/skills/dbt-parser-refresh/SKILL.md`](.claude/skills/dbt-parser-refresh/SKILL.md) for the refresh workflow.

## License

See [`LICENSE`](LICENSE) and [`LICENSES/README.md`](LICENSES/README.md).
