---
name: dbt-parser-refresh
description: Regenerates TypeScript types from dbt artifact JSON schemas. Use when the user asks to update parsers, sync with upstream, refresh types, or regenerate parser types from existing schemas.
compatibility: Requires pnpm, Node.js
---

# dbt Parser Refresh

## Trigger scenarios

Activate this skill when the user says or implies:

- Refresh parsers, update parsers, sync parsers
- Sync with upstream dbt artifact schemas
- Regenerate TypeScript types, regenerate parser types, run codegen
- Download dbt schemas from schemas.getdbt.com

## Scripts and paths

- Run commands from the **repository root**.
- **Fetch schemas:** Download pinned JSON Schema files from [schemas.getdbt.com](https://schemas.getdbt.com/).
  - `pnpm fetch:schemas` (or `pnpm --filter dbt-artifacts-parser fetch:schemas`)
  - Manifest: `packages/dbt-artifacts-parser/scripts/schemas.json`
- **Generate types:** Regenerate TypeScript from vendored schemas in `packages/dbt-artifacts-parser/resources/`.
  - `pnpm --filter dbt-artifacts-parser gen:types` or `bash packages/dbt-artifacts-parser/scripts/generate.sh`
- **Schema location:** `packages/dbt-artifacts-parser/resources/{catalog,manifest,run-results,sources}/` as top-level `*_vN.json` files. Each becomes `src/<category>/vN.ts` (run-results → `run_results` in `src/`).
- **Fixtures:** Sample artifacts live under `resources/<category>/vN/<project>/` (not used by `gen:types`).
- **Hand-maintained:** `src/<category>/index.ts` parsers are **not** overwritten by `generate.sh`.
- The generate script processes all `*_vN.json` files in each category directory; it does not accept artifact_type or version arguments.

## Adding new schema versions

1. Add `{ "url": "...", "out": "resources/..." }` to `scripts/schemas.json`.
2. Run `pnpm fetch:schemas`.
3. Run `pnpm gen:types`.
4. Wire `parse*VN` and unions in `src/<category>/index.ts`, plus tests and optional fixtures.

## Example

Full refresh (download + codegen):

```bash
pnpm fetch:schemas
pnpm --filter dbt-artifacts-parser gen:types
```
