# Playwright conventions (`@dbt-tools/web`)

Source of truth: [`packages/dbt-tools/web/playwright.config.ts`](../../../../packages/dbt-tools/web/playwright.config.ts).

## Server and base URL

- **`baseURL`:** `http://localhost:4173`
- **`webServer`:** `pnpm exec vite build && pnpm exec vite preview` in the web package (working directory is the package when Playwright runs from there).
- Tests always hit the **preview** server. Do not assume HMR, dev-only env, or behaviors that differ between `pnpm dev` and `vite preview` unless you explicitly verify both.

## Projects and reporting

- **Browser project:** Chromium (`Desktop Chrome`) only.
- **Parallelism:** `fullyParallel: true`; in CI, `workers: 1`, `retries: 2`.
- **Traces:** `trace: "on-first-retry"` — useful when debugging flakes in CI.

## Selector priority

1. **`getByRole`** with accessible name (buttons, headings, regions).
2. **`getByLabel`** when the control has an associated label (e.g. file inputs labeled in the UI).
3. **`data-testid`** — reserved for future use if the team adds explicit test hooks; prefer roles/labels first.
4. **Stable `id`** — use when the component documents it for integration (e.g. `#manifest-input`, `#run-results-input` in `FileUpload.tsx`).

Avoid long CSS selectors tied to layout or third-party class names.

## Waits and timeouts

- Prefer **`expect(locator).toBeVisible()`** and other `expect` auto-waiting assertions over fixed sleeps.
- Use explicit **`timeout`** on `expect` when the app performs heavy work (e.g. large artifact parse); keep values realistic.
- Avoid `page.waitForTimeout` except as a last resort; if used, comment why a condition-based wait is impossible.

## Anti-patterns

- Relying on **dev-server-only** behavior while CI uses preview.
- Assertions on **implementation details** (internal state, minified class strings) instead of user-visible outcomes.
- **Unskipping** tests without resolving preview/bundle errors noted in the spec (e.g. dynamic import / `require` issues).

## Local debugging

From repo root:

```bash
pnpm --filter @dbt-tools/web exec playwright test --ui
```

(Adjust flags as needed; ensure the same `playwright.config.ts` applies.)
