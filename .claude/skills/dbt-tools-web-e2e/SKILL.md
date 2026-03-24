---
name: dbt-tools-web-e2e
description: Implement and extend deterministic Playwright E2E tests for @dbt-tools/web (packages/dbt-tools/web). Use when adding or changing E2E specs, user-journey tests, analyze flow coverage, Playwright selectors, or fixtures aligned with the real UI—not autonomous browser LLM exploration.
compatibility: Requires pnpm, Node as in repo .node-version; Playwright via @dbt-tools/web devDependencies. Run commands from repository root unless noted.
---

# dbt-tools web E2E (Playwright)

## Triggers

Use this skill when the user asks or implies:

- Add, extend, or fix **Playwright** / **E2E** tests for the dbt artifact analyzer web app
- Test a **user flow** (upload, analyze, navigation) against **`@dbt-tools/web`**
- Choose **selectors** or **fixtures** for web tests
- **Regression** coverage for UI that ships under `packages/dbt-tools/web`

This skill covers **deterministic** automation (specs + CI-style runs). It does **not** describe autonomous “AI dogfooding” browsers; use normal product requirements and implementation code as the source of truth.

## Scope

- **Package:** `@dbt-tools/web` → [`packages/dbt-tools/web`](../../../packages/dbt-tools/web)
- **Specs:** `packages/dbt-tools/web/e2e/**/*.spec.ts`
- **Config:** [`packages/dbt-tools/web/playwright.config.ts`](../../../packages/dbt-tools/web/playwright.config.ts)

## Implementation-first workflow

1. **Read the UI code** under [`packages/dbt-tools/web/src/`](../../../packages/dbt-tools/web/src/) for the flow under test. Prefer stable, intentional hooks:
   - `page.getByRole(...)`, `getByLabel(...)`, `getByText(...)` where accessible names match the app
   - Stable `id` attributes when they are part of the contract (e.g. file inputs in `FileUpload.tsx`)
2. **Assert what users see:** headings, buttons, key labels, visible error text—avoid brittle CSS chains and layout-only selectors.
3. **Fixtures:** Reuse canonical artifact JSON where possible; add small files under `e2e/fixtures/` when the scenario needs them. See [fixtures and paths](references/fixtures-and-paths.md).
4. **Author specs** next to existing tests; keep one logical flow per `describe` when practical. For a minimal skeleton, see [spec block template](assets/templates/spec-block.md).
5. **Run E2E** from the repository root:
   - `pnpm test:e2e`
   - or `pnpm --filter @dbt-tools/web test:e2e`
6. **Quality gates** (after meaningful UI or flow work): from repo root, also run `pnpm lint:report` and `pnpm coverage:report`. E2E does not replace unit-test coverage thresholds.

## Preview build constraint

Playwright starts **`vite preview`** on `http://localhost:4173` (see `playwright.config.ts`). **`dist/` must already exist**—run `pnpm build` / `pnpm --filter @dbt-tools/web build` first, or rely on the **Test** workflow which builds before E2E. Tests exercise the **production preview** bundle, not `pnpm dev`.

Some flows may **fail or be skipped** in preview while they work in dev—for example, code paths that assume Node `require` or dev-only bundling. Do **not** remove `test.skip` or weaken assertions without **fixing the underlying preview/bundle issue**. Document new skips with a short comment pointing to the root cause.

Details: [Playwright conventions](references/playwright-conventions.md).

## Further reading

- [Playwright conventions](references/playwright-conventions.md) — base URL, selectors, flakiness, CI settings
- [Fixtures and paths](references/fixtures-and-paths.md) — canonical manifest/run_results paths and local fixtures
- Product UI tone and stack: [`.codex/skills/frontend-skill/SKILL.md`](../../../.codex/skills/frontend-skill/SKILL.md)
