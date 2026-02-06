# CLAUDE.md - AI Assistant Guide for dbt-artifacts-parser-ts

This document provides comprehensive guidance for AI assistants working with the dbt-artifacts-parser-ts codebase.

## Project Overview

**dbt-artifacts-parser-ts** is a TypeScript library for parsing dbt artifacts with full type safety and automatic version detection. It provides:

- Complete TypeScript type definitions for all dbt artifact versions
- Automatic version detection for artifacts
- Version-specific parsers for explicit control
- Support for manifest (v1-v12), catalog (v1), run_results (v1-v6), and sources (v1-v3)

**Technology Stack:**
- **Language:** TypeScript 5.9.3 (strict mode)
- **Runtime:** Node.js v22.10.0
- **Package Manager:** pnpm (workspace-enabled monorepo)
- **Build Tool:** TypeScript Compiler (tsc)
- **Test Framework:** Vitest 4.0.16
- **Linter:** Trunk (multi-linter orchestrator)
- **Type Generation:** json-schema-to-typescript

## Repository Structure

```
dbt-artifacts-parser-ts/
├── .cursor/rules/           # Cursor AI configuration
├── .github/workflows/       # CI/CD pipelines (build, test, publish, trunk)
├── .trunk/                  # Trunk linter configuration
├── .vscode/                 # VSCode settings
├── packages/
│   └── dbt-artifacts-parser/
│       ├── src/
│       │   ├── catalog/         # Catalog artifact types & parsers
│       │   │   ├── index.ts     # Main exports & parsers
│       │   │   ├── index.test.ts
│       │   │   └── v1.ts        # Type definitions (hand-written)
│       │   ├── manifest/        # Manifest artifact types & parsers
│       │   │   ├── index.ts
│       │   │   ├── index.test.ts
│       │   │   ├── v1.ts through v12.ts  # Some generated, some hand-written
│       │   │   └── v*.test.ts
│       │   ├── run_results/     # RunResults artifact types & parsers
│       │   │   ├── index.ts
│       │   │   ├── index.test.ts
│       │   │   └── v1.ts through v6.ts
│       │   ├── sources/         # Sources artifact types & parsers
│       │   │   ├── index.ts
│       │   │   ├── index.test.ts
│       │   │   └── v1.ts, v2.ts, v3.ts
│       │   ├── tests/resources/ # Test fixture JSON files
│       │   │   ├── catalog/v1/jaffle_shop/
│       │   │   ├── manifest/v{1-12}/jaffle_shop/
│       │   │   └── run_results/v{1-6}/jaffle_shop/
│       │   └── index.ts         # Root entry point (namespaced exports)
│       ├── resources/
│       │   ├── catalog/         # JSON schemas
│       │   ├── manifest/        # JSON schemas v1-v12
│       │   ├── run-results/     # JSON schemas v1-v6
│       │   └── sources/         # JSON schemas v1-v3
│       ├── scripts/
│       │   ├── generate.sh      # Type generation orchestration
│       │   └── preprocess-refs.js  # $ref dereferencing script
│       ├── dist/                # Compiled output (gitignored)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── package.json                 # Root workspace package
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

## Development Environment Setup

### Prerequisites
```bash
# Node.js version
node --version  # Should be v22.10.0 (see .node-version)

# Install pnpm if not available
npm install -g pnpm

# Install dependencies
pnpm install
```

### Key Configuration Files

#### TypeScript Configuration (`packages/dbt-artifacts-parser/tsconfig.json`)
- **Target:** ES2017
- **Module:** CommonJS
- **Strict mode:** Enabled
- **Declaration files:** Generated in `./dist`
- **Excludes:** Test files (`*.test.ts`), resources (`resources/`, `tests/`)

#### Package Configuration
- **Main entry:** `dist/index.js`
- **Types entry:** `dist/index.d.ts`
- **Published as:** `@yu-iskw/dbt-artifacts-parser` (public npm package)

## Key Concepts and Architecture

### Module Organization Pattern

Each artifact category (catalog, manifest, run_results, sources) follows this structure:

1. **index.ts** - Main exports file containing:
   - Latest version type re-export
   - Versioned type aliases (e.g., `ManifestV1`, `ManifestV12`)
   - Union type for all versions (e.g., `ParsedManifest`)
   - Main parser function with auto-detection (e.g., `parseManifest()`)
   - Version-specific parsers (e.g., `parseManifestV1()` through `parseManifestV12()`)

2. **v{N}.ts** - Version-specific type definitions:
   - **Auto-generated files:** v3-v10 for manifest, v3-v4 for run_results
   - **Hand-written files:** v1, v2, v11, v12 for manifest; v1, v2, v5, v6 for run_results
   - Type names: Manual types use simple names (e.g., `Manifest`, `WritableManifest`), generated types use schema-derived names (e.g., `HttpsSchemasGetdbtComDbtManifestV7Json`)

3. **index.test.ts** - Category-level tests with dynamic resource discovery
4. **v{N}.test.ts** - Version-specific tests

### Import Patterns Supported

The library supports three import patterns:

```typescript
// 1. Category-level imports (latest version)
import { WritableManifest, parseManifest } from "dbt-artifacts-parser/manifest";

// 2. Version-specific imports
import { Manifest } from "dbt-artifacts-parser/manifest/v1";
import { WritableManifest } from "dbt-artifacts-parser/manifest/v12";

// 3. Namespaced imports
import { manifest, catalog, run_results, sources } from "dbt-artifacts-parser";
const parsed = manifest.parseManifest(json);
```

### Parser Function Pattern

All parsers follow this convention:

```typescript
// Auto-detection parser
export function parseManifest(manifest: Record<string, unknown>): ParsedManifest {
  const version = manifest?.metadata?.dbt_schema_version;
  switch (version) {
    case "https://schemas.getdbt.com/dbt/manifest/v1.json":
      return manifest as ManifestV1;
    // ... other versions
    default:
      throw new Error(`Unsupported manifest version: ${version}`);
  }
}

// Version-specific parser
export function parseManifestV1(manifest: Record<string, unknown>): ManifestV1 {
  const version = manifest?.metadata?.dbt_schema_version;
  if (version !== "https://schemas.getdbt.com/dbt/manifest/v1.json") {
    throw new Error("Not a manifest.json v1");
  }
  return manifest as ManifestV1;
}
```

## Build and Type Generation

### Standard Build Process

```bash
# From repository root
pnpm build          # Builds all packages recursively

# From packages/dbt-artifacts-parser
pnpm build          # Runs tsc to compile TypeScript to dist/
```

Build outputs:
- `dist/index.js` - Compiled JavaScript
- `dist/index.d.ts` - Type declarations
- `dist/{category}/` - Category-specific compiled files

### Type Generation from JSON Schemas

**IMPORTANT:** Most `v{N}.ts` files are auto-generated. Do not manually edit generated files.

Type generation workflow:

```bash
# From packages/dbt-artifacts-parser
pnpm gen:types      # Runs scripts/generate.sh
```

**Generation Process (`scripts/generate.sh`):**

1. **Clean:** Removes old generated `v*.ts` files (preserves `v*.test.ts`)
2. **Preprocess:** Dereferences JSON schema `$ref` fields using `scripts/preprocess-refs.js`
3. **Generate:** Converts JSON schemas to TypeScript using `json2ts`
4. **Index:** Creates `index.ts` files with versioned exports

**Preprocessing (`scripts/preprocess-refs.js`):**
- Uses `@apidevtools/json-schema-ref-parser` to dereference `$ref` patterns
- Security: Disables HTTP resolution, validates paths
- Only dereferences if root-level `$ref` exists, otherwise copies as-is

**json2ts Options:**
- `--unknownAny` - Uses `any` for unknown types
- `--unreachableDefinitions` - Includes all schema definitions
- `--format` - Applies Prettier formatting

### When to Regenerate Types

Regenerate types when:
- Adding new dbt artifact version schemas to `resources/`
- Modifying existing JSON schemas
- Updating json-schema-to-typescript library

**Do NOT regenerate** for:
- Fixing parser logic (only edit `index.ts`)
- Adding tests
- Updating documentation

## Testing Guidelines

### Test Framework: Vitest

```bash
# Run all tests
pnpm test

# Watch mode (auto-rerun on changes)
pnpm test:watch
```

### Test Structure

**Test Resource Files:**
Located in `src/tests/resources/{artifact}/v{N}/jaffle_shop/`

- `manifest.json` - Example dbt manifest for each version
- `catalog.json` - Example catalog
- `run_results.json` - Example run results
- Uses real jaffle_shop project fixtures

**Test Patterns:**

1. **Dynamic Resource Discovery:**
```typescript
function discoverManifestFiles(): Map<number, string> {
  const resourcesDir = path.join(__dirname, "tests", "resources", "manifest");
  // Recursively finds all manifest.json files
  // Maps version number to file path
  // Validates paths to prevent traversal attacks
}
```

2. **Version Detection Tests:**
```typescript
describe.each([...manifestFiles.entries()])("Manifest v%i", (version, filePath) => {
  test("should detect version correctly", () => {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const parsed = parseManifest(data);
    expect(parsed.metadata.dbt_schema_version).toContain(`v${version}`);
  });
});
```

3. **Error Handling Tests:**
```typescript
test("should throw on invalid manifest", () => {
  expect(() => parseManifest({})).toThrow("Not a manifest.json");
});

test("should throw on wrong version", () => {
  expect(() => parseManifestV1(v2Data)).toThrow("Not a manifest.json v1");
});
```

### Adding Tests for New Versions

When adding a new artifact version:

1. Add JSON schema to `resources/{artifact}/{artifact}_v{N}.json`
2. Add test fixture to `src/tests/resources/{artifact}/v{N}/jaffle_shop/{artifact}.json`
3. Run `pnpm gen:types` to generate types
4. Version-specific tests will auto-discover new fixtures
5. Optionally add `v{N}.test.ts` for specific test cases

## Coding Conventions

### File Naming
- **Generated types:** `v1.ts`, `v2.ts`, etc. (lowercase 'v')
- **Tests:** `v1.test.ts`, `index.test.ts`
- **JSON schemas:** `manifest_v1.json` (underscore separator)
- **Index files:** `index.ts` (main exports)

### Type Naming
- **Latest version aliases:** Use simple names (`WritableManifest`, `CatalogArtifact`)
- **Versioned aliases:** Add `V{N}` suffix (`ManifestV1`, `RunResultsArtifactV6`)
- **Union types:** `Parsed{Artifact}` prefix (`ParsedManifest`, `ParsedCatalog`)
- **Generated types:** Keep schema-derived names unchanged

### Export Patterns

**Category index.ts structure:**
```typescript
// 1. Import all versions
import { Manifest as ManifestV1 } from "./v1";
import { WritableManifest as ManifestV12 } from "./v12";
// ... other versions

// 2. Create versioned aliases
export type { ManifestV1, ManifestV12 /* ... */ };

// 3. Re-export latest as default name
export type { WritableManifest };

// 4. Define union type
export type ParsedManifest = ManifestV1 | ManifestV2 | /* ... */ | ManifestV12;

// 5. Export parser functions
export function parseManifest(manifest: Record<string, unknown>): ParsedManifest { /* ... */ }
export function parseManifestV1(manifest: Record<string, unknown>): ManifestV1 { /* ... */ }
// ... other version parsers
```

**Root index.ts structure:**
```typescript
export * as catalog from "./catalog";
export * as manifest from "./manifest";
export * as run_results from "./run_results";
export * as sources from "./sources";
```

### Error Messages

Follow these conventions:
- Invalid structure: `"Not a {artifact}.json"`
- Wrong version: `"Not a {artifact}.json v{N}"`
- Unsupported version: `"Unsupported {artifact} version: {version}"`

### Code Style
- **Formatting:** Handled by Prettier via Trunk
- **Linting:** Trunk orchestrates multiple linters
- **Indentation:** 2 spaces (TypeScript), follow existing patterns
- **Quotes:** Double quotes for strings
- **Semicolons:** Required

## Git Workflow

### Branch Strategy
- **Main branch:** `main` (protected)
- **Feature branches:** Create from main, use descriptive names
- **CI runs on:** Pull requests, pushes to main

### Commit Message Format
Recent commits show pattern: `"Action: Description"`

Examples:
- `"Improve parsers"`
- `"Bump actions/checkout from 2 to 4"`
- `"Upgrade packages"`
- `"Exclude unnecessary files from package"`

### CI/CD Workflows

**build.yml** - Builds project on PR/push to main
- Node 22 setup
- pnpm install and build
- Cancels previous runs on new pushes

**test.yml** - Runs tests on PR/push to main
- Node 22 setup
- pnpm install and test
- Cancels previous runs

**publish-dbt-artifacts-parser.yml** - Publishes to npm on release
- Triggers: Release published, manual dispatch
- Runs: build, test, then publishes to npm
- Uses `NPM_TOKEN` secret for authentication
- Published as `@yu-iskw/dbt-artifacts-parser`

**trunk_check.yml** - Runs Trunk linting on PRs
- Posts annotations to GitHub checks

**trunk_upgrade.yml** - Auto-upgrades Trunk version

### Pre-Push Checklist

Before creating a PR:
```bash
# 1. Run linters
pnpm lint            # Run Trunk checks on changed files
pnpm lint:all        # Run on all files (recommended before PR)

# 2. Run formatters
pnpm format          # Format changed files
pnpm format:all      # Format all files

# 3. Run tests
pnpm test            # Ensure all tests pass

# 4. Build
pnpm build           # Verify build succeeds
```

## Common Tasks

### Adding a New Artifact Version

Example: Adding manifest v13

1. **Add JSON schema:**
```bash
# Add to resources/manifest/manifest_v13.json
```

2. **Generate types:**
```bash
cd packages/dbt-artifacts-parser
pnpm gen:types
```

3. **Update index.ts:**
```typescript
// In src/manifest/index.ts
import { /* Type */ as ManifestV13 } from "./v13";

export type { ManifestV13 };
export type ParsedManifest = ManifestV1 | /* ... */ | ManifestV13;

export function parseManifest(manifest: Record<string, unknown>): ParsedManifest {
  const version = manifest?.metadata?.dbt_schema_version;
  switch (version) {
    // ... existing cases
    case "https://schemas.getdbt.com/dbt/manifest/v13.json":
      return manifest as ManifestV13;
    default:
      throw new Error(`Unsupported manifest version: ${version}`);
  }
}

export function parseManifestV13(manifest: Record<string, unknown>): ManifestV13 {
  const version = manifest?.metadata?.dbt_schema_version;
  if (version !== "https://schemas.getdbt.com/dbt/manifest/v13.json") {
    throw new Error("Not a manifest.json v13");
  }
  return manifest as ManifestV13;
}
```

4. **Add test fixture:**
```bash
# Create directory
mkdir -p src/tests/resources/manifest/v13/jaffle_shop/

# Add manifest.json with real dbt v13 output
```

5. **Run tests:**
```bash
pnpm test
```

6. **Update README:** Add v13 to supported versions list

### Fixing a Parser Bug

1. **Identify the issue:** Check which parser function has the bug
2. **Write a failing test:** Add test case in `{category}/index.test.ts`
3. **Fix the parser:** Edit `{category}/index.ts` (NOT generated files)
4. **Run tests:** `pnpm test`
5. **Commit:** Use descriptive commit message

### Updating Generated Types

If json-schema-to-typescript output needs customization:

1. **Check if version is hand-written:** v1, v2, v11, v12 for manifest are hand-written
2. **For generated files:** Modify the JSON schema source in `resources/`
3. **Regenerate:** `pnpm gen:types`
4. **Verify:** Check generated file matches expectations
5. **Test:** `pnpm test`

**Do NOT directly edit generated `v{N}.ts` files** - changes will be lost on next generation

### Running Security Scans

```bash
pnpm lint:security   # Runs Trunk security linters
```

Enabled security scanners:
- `trivy` - Vulnerability scanner
- `osv-scanner` - Open Source Vulnerability scanner

## Important Notes for AI Assistants

### Code Generation Rules

1. **DO NOT edit generated files:**
   - Files in `src/{category}/v{N}.ts` (except v1, v2, v11, v12 for manifest; v1, v2, v5, v6 for run_results)
   - These are regenerated from JSON schemas
   - Check file header comments for generation markers

2. **Parser functions only in index.ts:**
   - All parser logic belongs in `{category}/index.ts`
   - Version files should only contain type definitions

3. **Maintain export patterns:**
   - Keep versioned aliases (e.g., `ManifestV1`)
   - Maintain union types (e.g., `ParsedManifest`)
   - Preserve namespaced exports in root index.ts

4. **Follow TypeScript strict mode:**
   - Avoid `any` types unless necessary
   - Provide explicit return types for exported functions
   - Use type guards where appropriate

### Testing Best Practices

1. **Use existing test fixtures:**
   - Leverage jaffle_shop examples in `tests/resources/`
   - Add new fixtures only for new versions

2. **Dynamic test discovery:**
   - Use `discover*Files()` pattern for version iteration
   - Tests automatically pick up new versions

3. **Error case coverage:**
   - Test invalid inputs
   - Test version mismatches
   - Test unsupported versions

### Build and Deployment

1. **Build before committing:**
   - Always run `pnpm build` to verify compilation
   - CI will fail if build breaks

2. **Type generation is separate:**
   - `pnpm gen:types` is NOT part of standard build
   - Only run when schemas change

3. **Publication is automated:**
   - Triggered by GitHub releases
   - Do NOT manually publish to npm
   - Version bumps should update package.json

### Security Considerations

1. **Path traversal prevention:**
   - Test resource discovery validates paths
   - Never construct file paths from untrusted input

2. **Schema preprocessing security:**
   - HTTP resolution disabled in preprocess-refs.js
   - Only local schemas are processed

3. **Dependency updates:**
   - Dependabot runs monthly
   - Review and merge security updates promptly

### Performance Considerations

1. **Type generation is slow:**
   - json2ts processes many schemas
   - Run only when necessary
   - CI does not regenerate types (uses committed files)

2. **Test execution:**
   - Dynamic discovery adds overhead
   - Consider specific test files during development
   - Full test suite runs in CI

### Documentation Standards

1. **README.md** (user-facing):
   - Keep usage examples up to date
   - Document all import patterns
   - Include error handling examples

2. **CLAUDE.md** (this file, AI-facing):
   - Update when architecture changes
   - Document new patterns and conventions
   - Keep development workflows current

3. **Code comments:**
   - Minimal comments in generated files
   - Document complex logic in parsers
   - Explain non-obvious type decisions

## File Reference Quick Guide

### Configuration
- `package.json` (root) - Workspace scripts, dev dependencies
- `packages/dbt-artifacts-parser/package.json` - Package metadata, build scripts
- `packages/dbt-artifacts-parser/tsconfig.json` - TypeScript configuration
- `pnpm-workspace.yaml` - pnpm workspace definition
- `.node-version` - Node.js version (v22.10.0)

### Build & Generation
- `scripts/generate.sh` - Type generation orchestration
- `scripts/preprocess-refs.js` - JSON schema $ref dereferencing

### Source Code
- `src/index.ts` - Root entry point (namespaced exports)
- `src/{category}/index.ts` - Category exports and parsers
- `src/{category}/v{N}.ts` - Version-specific types
- `src/{category}/*.test.ts` - Test suites

### Resources
- `resources/{category}/{artifact}_v{N}.json` - JSON schemas (source of truth)
- `src/tests/resources/{category}/v{N}/jaffle_shop/` - Test fixtures

### CI/CD
- `.github/workflows/build.yml` - Build workflow
- `.github/workflows/test.yml` - Test workflow
- `.github/workflows/publish-dbt-artifacts-parser.yml` - NPM publish workflow
- `.github/workflows/trunk_check.yml` - Linting workflow

### Linting
- `.trunk/trunk.yaml` - Trunk configuration (multi-linter)
- `.trunk/configs/.markdownlint.yaml` - Markdown linting rules

## Version Support Matrix

| Artifact | Versions | Latest | Hand-written | Generated |
|----------|----------|--------|--------------|-----------|
| Manifest | v1-v12 | v12 (WritableManifest) | v1, v2, v11, v12 | v3-v10 |
| Catalog | v1 | v1 (CatalogArtifact) | v1 | - |
| RunResults | v1-v6 | v6 (RunResultsArtifact) | v1, v2, v5, v6 | v3, v4 |
| Sources | v1-v3 | v3 (FreshnessExecutionResultArtifact) | v1, v3 | v2 |

## Useful Commands Reference

```bash
# Installation
pnpm install                    # Install all dependencies

# Development
pnpm build                      # Build all packages
pnpm test                       # Run tests (all packages)
pnpm test:watch                 # Run tests in watch mode
pnpm gen:types                  # Generate types from JSON schemas

# Linting & Formatting
pnpm lint                       # Lint changed files
pnpm lint:all                   # Lint all files
pnpm lint:security              # Security-focused linting
pnpm format                     # Format changed files
pnpm format:all                 # Format all files

# Package-specific (from packages/dbt-artifacts-parser/)
cd packages/dbt-artifacts-parser
pnpm build                      # Build this package only
pnpm test                       # Test this package only
pnpm gen:types                  # Generate types

# Utilities
pnpm json2ts                    # Access json-schema-to-typescript CLI
```

## Troubleshooting

### Build Failures

**Issue:** `tsc` compilation errors
- **Check:** TypeScript strict mode errors
- **Fix:** Review type definitions, ensure proper type annotations
- **Verify:** Run `pnpm build` locally before pushing

**Issue:** Missing dependencies
- **Check:** `pnpm-lock.yaml` is committed
- **Fix:** Run `pnpm install` to regenerate lockfile
- **Verify:** CI uses same pnpm version

### Test Failures

**Issue:** Parser tests failing
- **Check:** Test fixtures match expected schema versions
- **Fix:** Update fixtures or parser logic
- **Debug:** Run specific test file with `vitest run src/{category}/index.test.ts`

**Issue:** Resource discovery failures
- **Check:** File paths in `tests/resources/` follow naming convention
- **Fix:** Ensure directory structure is `{category}/v{N}/jaffle_shop/{artifact}.json`

### Type Generation Issues

**Issue:** json2ts fails to generate types
- **Check:** JSON schema is valid JSON
- **Fix:** Validate schema with `json-schema.org` validator
- **Verify:** Run `node scripts/preprocess-refs.js` manually

**Issue:** Generated types don't match schema
- **Check:** Preprocessing step completed successfully
- **Fix:** Review `preprocess-refs.js` output
- **Regenerate:** Delete generated file and rerun `pnpm gen:types`

### Linting Failures

**Issue:** Trunk check failures
- **Check:** Run `pnpm lint:all` locally
- **Fix:** Run `pnpm format:all` to auto-fix formatting
- **Review:** Check `.trunk/trunk.yaml` for specific linter rules

**Issue:** Security scan failures
- **Check:** Run `pnpm lint:security`
- **Fix:** Update vulnerable dependencies
- **Escalate:** Review severity and impact before updating

## Related Resources

- **Main Repository:** https://github.com/yu-iskw/dbt-artifacts-parser-ts
- **NPM Package:** https://www.npmjs.com/package/@yu-iskw/dbt-artifacts-parser
- **Python Version:** https://github.com/yu-iskw/dbt-artifacts-parser
- **dbt Documentation:** https://docs.getdbt.com/
- **dbt JSON Schemas:** https://schemas.getdbt.com/

---

**Last Updated:** 2026-02-06

**Maintainer:** yu-iskw

**For Questions:** Open an issue on GitHub
