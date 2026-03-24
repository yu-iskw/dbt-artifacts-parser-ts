# Fixtures and paths for E2E

Specs live under `packages/dbt-tools/web/e2e/`. Resolve paths from the spec file with `import.meta.url` and `path.resolve` so they work in ESM.

## Canonical dbt artifact JSON (workspace)

Used by [`analyze-flow.spec.ts`](../../../../packages/dbt-tools/web/e2e/analyze-flow.spec.ts):

| Role           | Path (from repo root)                                                                 |
| -------------- | ------------------------------------------------------------------------------------- |
| Manifest v12   | `packages/dbt-artifacts-parser/resources/manifest/v12/jaffle_shop/manifest_1.10.json` |
| Run results v6 | `packages/dbt-artifacts-parser/resources/run_results/v6/jaffle_shop/run_results.json` |

Resolve from `e2e/` with enough `..` segments to reach the repo layout (see existing spec for the exact `path.resolve` pattern).

## Local E2E fixtures

| File                                               | Purpose                           |
| -------------------------------------------------- | --------------------------------- |
| `packages/dbt-tools/web/e2e/fixtures/invalid.json` | Invalid JSON for error-path tests |

Add new files under `e2e/fixtures/` when:

- The scenario needs **small, controlled** inputs not worth putting in `dbt-artifacts-parser/resources/`.
- You want **redacted or minimal** JSON that is easier to read in code review.

Keep fixtures **small**; prefer shared resources under `dbt-artifacts-parser/resources/` for real multi-version artifact examples.

## Labels and file inputs

The analyze flow uses labeled file inputs; stable `id` values are defined in `FileUpload.tsx` (e.g. `manifest-input`, `run-results-input`). Prefer matching **visible labels** and roles in tests when they stay in sync with the component.
