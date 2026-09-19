# 6. Schema version is the JSON artifact contract

Date: 2026-09-19

## Status

Accepted

## Context

dbt executable releases and dbt artifact schema majors are independent. dbt 2.x (the
Rust engine, formerly Fusion) continues to emit the same public JSON schema URLs that
dbt Core 1.8–1.12 already used for `manifest.json`, `run_results.json`, `catalog.json`,
and `sources.json`. It also adds a new JSON artifact, `freshness.json`, published as
`freshness/v0`.

A new executable version is easy to mistake for a new parser generation. Early 2.x
betas even wrote an unpublished `manifest/v20` URL before the public registry stayed
on v12. Treating producer semver as the dispatch key would fork the parser on every
dbt release, invent unpublished majors, or conflate `freshness.json` with legacy
`sources.json`.

This repository generates TypeScript types from official JSON Schema and selects a
parser from `metadata.dbt_schema_version`. Runtime parse is a schema-URL gate plus a
type assertion, not full schema validation. Official schemas often set
`additionalProperties: false`, while 2.x payloads may include extra keys. Strict
fixture validation against those schemas would reject compatible artifacts that this
parser is designed to accept.

## Decision

Parser selection and generated-type refresh follow **artifact schema version**, not
dbt executable version.

### Durable invariants

1. **Dispatch uses `metadata.dbt_schema_version`.** The URL (for example
   `https://schemas.getdbt.com/dbt/manifest/v12.json`) is the compatibility key.
   `metadata.dbt_version` is producer metadata only.
2. **A new dbt executable needs new generated types only when upstream publishes a
   new artifact type or a new schema major.** Reused majors (manifest v12, catalog v1,
   run-results v6, sources v3) stay on the existing parsers.
3. **New official artifact types become new categories.** `freshness.json` (`/freshness/v0.json`)
   is distinct from `sources.json` (`/sources/v3.json`) even though both describe
   freshness results.
4. **Official public schemas are the codegen source of truth.** Types come from
   `schemas.getdbt.com` / `dbt-labs/schemas.getdbt.com`. Unpublished URLs, Parquet
   metadata, and reverse-engineered Rust structs are not the JSON parser contract.
5. **Generated `vN.ts` files are not hand-edited.** Schema changes flow through
   vendored JSON Schema and the existing codegen script.
6. **Runtime parse does not imply JSON Schema validation.** Extra keys on a known
   schema major must not fail dispatch. Optional strict validation, if added later,
   is a separate concern from parsing.

## Consequences

**Positive:**

- dbt 2.x JSON works without inventing Manifest v13 / Catalog v2 / Run Results v7.
- Freshness v0 can ship as its own export without breaking `parseSources`.
- Future executable releases do not require a parser bump unless the registry moves.

**Negative / risks:**

- Extra 2.x fields are present at runtime but absent from generated interfaces until
  the official schema includes them.
- Callers who branch on `dbt_version` instead of `dbt_schema_version` will still
  write incorrect client code; docs must keep stating the rule.

## Alternatives considered

- **Dispatch on `metadata.dbt_version`:** Rejected because Core 1.8–1.12 and dbt 2.x
  share schema majors; producer semver is not a schema.
- **Invent new schema majors for 2.x:** Rejected because the public registry did not
  publish them. Unpublished `manifest/v20` was a beta detour.
- **Parse `freshness.json` through the sources dispatcher:** Rejected because the
  schema URL and file are different; sources must remain parseable as `/sources/vN`.
- **Validate 2.x fixtures with strict official JSON Schema in CI:** Rejected for this
  decision because `additionalProperties: false` plus extra 2.x keys would fail
  artifacts the parser intentionally accepts.

## Trade-offs

Choosing schema-URL dispatch over producer-version dispatch keeps codegen aligned
with the public registry and avoids false major bumps. The cost is that Fusion-only
fields are untyped until they land in official schemas.

## References

- Related: [0001](./0001-record-architecture-decisions.md) — ADR policy
- Official schema source: [dbt-labs/schemas.getdbt.com](https://github.com/dbt-labs/schemas.getdbt.com)
- Issue: [yu-iskw/dbt-artifacts-parser-ts#190](https://github.com/yu-iskw/dbt-artifacts-parser-ts/issues/190)
