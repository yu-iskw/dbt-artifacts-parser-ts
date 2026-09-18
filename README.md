# dbt-artifacts-parser

TypeScript parser and generated type package for dbt artifact JSON files.

## Related packages

Python users should use [dbt-artifacts-parser](https://github.com/yu-iskw/dbt-artifacts-parser) (PyPI package `dbt-artifacts-parser`).

## Package

- [`packages/dbt-artifacts-parser`](packages/dbt-artifacts-parser) publishes `dbt-artifacts-parser`.

## dbt compatibility model

Parser types are versioned by `metadata.dbt_schema_version`, not by the dbt engine
version. dbt v2 currently continues to emit the existing JSON artifact schema families
(manifest v12, run-results v6, sources v3, and catalog v1), while the Rust producer can
have small wire-level differences from the published schemas.

This repository validates both:

- **Schema support:** generated TypeScript interfaces remain aligned with the published dbt JSON schemas.
- **Producer-tested support:** committed fixtures plus the
  [dbt v2 compatibility workflow](.github/workflows/dbt_v2_compatibility.yml) exercise
  dbt 2.0.0 and the latest 2.0.x producer.

Known producer-only differences live under `src/compatibility/`; generated `vN.ts`
files remain schema-derived. Parquet/index/metadata artifacts introduced by dbt v2 are
outside this JSON parser compatibility contract.

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
