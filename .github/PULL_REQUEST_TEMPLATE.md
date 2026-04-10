## Summary

<!-- What changed and why -->

## Checklist

- [ ] **Tests:** `pnpm test` (and `pnpm test:e2e` if UI flow / Playwright-relevant)
- [ ] **Lint:** `pnpm lint:report`, `pnpm knip`
- [ ] **Coverage:** `pnpm coverage:report` (thresholds in repo rules)
- [ ] **UI / tokens (if `@dbt-tools/web` UI changed):**
  - [ ] No new hardcoded hex/rgb spacing in feature or design-system code without token justification
  - [ ] Token JSON updated if new semantics needed; ran `pnpm tokens:web:build` and committed generated CSS/TS
  - [ ] `pnpm tokens:web:validate` passes
  - [ ] Light and dark themes considered (`tokens/themes/dark.json` if semantics differ)
