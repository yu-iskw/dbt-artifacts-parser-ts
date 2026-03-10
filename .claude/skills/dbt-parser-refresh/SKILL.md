---
name: dbt-parser-refresh
description: Regenerates TypeScript types from dbt artifact JSON schemas. Use when the user asks to update parsers, sync with upstream, refresh types, or regenerate parser types from existing schemas.
compatibility: Requires pnpm, Node.js
---

# dbt Parser Refresh

## Trigger scenarios

Activate this skill when the user says or implies:

- Refresh parsers, update parsers, sync parsers
- Update from dbt-core, sync with upstream dbt-core
- Regenerate TypeScript types, regenerate parser types, run codegen
- Download dbt schemas, pull schemas from dbt-core (note: this repo has no download script; schemas live in `resources/`)

## Scripts and paths

- Run commands from the **repository root**.
- **Generate (only):** Regenerate TypeScript types from existing JSON schemas in `packages/dbt-artifacts-parser/resources/`.
  - From repo root: `pnpm --filter @yu-iskw/dbt-artifacts-parser gen:types` or `bash packages/dbt-artifacts-parser/scripts/generate.sh`
  - From package: `cd packages/dbt-artifacts-parser && pnpm gen:types`
- **Schema location:** `packages/dbt-artifacts-parser/resources/{catalog,manifest,run-results,sources,semantic_manifest}/`. Each `*_vN.json` file is turned into `src/<category>/vN.ts`.
- **Artifact categories:** `catalog`, `manifest`, `run-results`, `sources`, `semantic_manifest`.
- The generate script does **not** accept artifact_type or version arguments; it processes all `*_vN.json` files in each category directory.

## Adding new schemas

This repo has no download script. To add new schema versions, copy JSON schema files (e.g. from dbt-core or <https://schemas.getdbt.com/>) into the appropriate `packages/dbt-artifacts-parser/resources/<category>/` directory, then run the generate command above.

## Example

Full regenerate (all categories and versions):

```bash
pnpm --filter @yu-iskw/dbt-artifacts-parser gen:types
```

Or from repo root using the script directly:

```bash
bash packages/dbt-artifacts-parser/scripts/generate.sh
```
