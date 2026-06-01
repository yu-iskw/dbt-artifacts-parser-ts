# dbt artifact resources

Canonical JSON Schema files for dbt artifacts are vendored here from [schemas.getdbt.com](https://schemas.getdbt.com/) only—not from the dbt-core GitHub repository.

## Layout

| Path pattern                                              | Purpose                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| `catalog/catalog_v1.json`, `manifest/manifest_vN.json`, … | Official JSON Schema sources used by `gen:types`                   |
| `run-results/run_results_vN.json`                         | Run-results schemas (hyphenated directory; underscore in filename) |
| `<category>/vN/<project>/*.json`                          | Sample artifact fixtures for tests (not used by codegen)           |
| `run_results/vN/<project>/*.json`                         | Run-results fixtures (underscore directory)                        |

Top-level `*_vN.json` files match `isVendoredJsonSchemaFile()` in `src/test-utils.ts` and are excluded from fixture discovery.

## Maintainer workflow

From the repository root:

```bash
# Download pinned schemas (see scripts/schemas.json)
pnpm fetch:schemas

# Regenerate TypeScript from vendored schemas
pnpm --filter dbt-artifacts-parser gen:types
```

To add a new schema version:

1. Add `{ "url": "...", "out": "..." }` to [`scripts/schemas.json`](../scripts/schemas.json).
2. Run `pnpm fetch:schemas`.
3. Run `pnpm --filter dbt-artifacts-parser gen:types`.
4. Wire parsers and tests in `src/<category>/` per [CONTRIBUTING.md](../../CONTRIBUTING.md).
