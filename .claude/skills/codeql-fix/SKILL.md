---
name: codeql-fix
description: Run CodeQL security/quality analysis and fix findings. Use when the user asks to run CodeQL, security scan, static analysis, or fix CodeQL findings.
compatibility: Requires CodeQL CLI on PATH (e.g. brew install codeql).
---

# CodeQL Fix

## Trigger scenarios

Activate this skill when the user says or implies:

- Run CodeQL, security scan, static analysis
- Fix CodeQL findings, address CodeQL alerts

## Command

Run from the **repository root**:

```bash
pnpm codeql
```

- Creates a CodeQL database (`codeql-db/`) and runs analysis
- Pre-check: [scripts/codeql-check.mjs](../../scripts/codeql-check.mjs) verifies CodeQL CLI is installed
- Output: `codeql-results.sarif` (view with SARIF Viewer in VS Code)

Install: [CodeQL CLI](https://github.com/github/codeql-cli-binaries/releases) (e.g. `brew install codeql`).

## Fixer loop

If SARIF findings remain:

1. **Identify:** Read `codeql-results.sarif` or the CLI output for reported findings.
2. **Fix:** Apply the minimum necessary edit to resolve each finding.
3. **Verify:** Re-run `pnpm codeql`.
4. Repeat until clean or up to 3 iterations to avoid unbounded loops.
