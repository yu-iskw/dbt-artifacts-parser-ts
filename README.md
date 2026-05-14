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

## Type generation

Parser schemas and generated sources live under [`packages/dbt-artifacts-parser`](packages/dbt-artifacts-parser). Use [`.claude/skills/dbt-parser-refresh/SKILL.md`](.claude/skills/dbt-parser-refresh/SKILL.md) for the refresh workflow.

## License

See [`LICENSE`](LICENSE) and [`LICENSES/README.md`](LICENSES/README.md).
