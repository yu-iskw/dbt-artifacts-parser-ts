# dbt-artifacts-parser-ts

TypeScript library for parsing dbt artifacts with full type safety and automatic version detection.

## Features

- **TypeScript Type Definitions**: Complete type definitions for all dbt artifact versions
- **Automatic Version Detection**: Automatically detects and parses artifacts based on their schema version
- **Version-Specific Parsers**: Explicit parsers for each artifact version
- **Full Type Safety**: TypeScript union types ensure type safety across all versions
- **Multiple Artifact Types**: Support for manifest, catalog, run_results, and sources artifacts
- **Comprehensive Version Support**:
  - Manifest: v1-v12
  - Catalog: v1
  - RunResults: v1-v6
  - Sources: v1-v3

## Installation

```bash
npm install dbt-artifacts-parser
# or
pnpm add dbt-artifacts-parser
```

## Usage

### Import Patterns

The library provides multiple import patterns to suit different use cases:

#### 1. Category Imports (Latest Version)

Import the latest version of each artifact type:

```typescript
import { WritableManifest } from "dbt-artifacts-parser/manifest";
import { CatalogArtifact } from "dbt-artifacts-parser/catalog";
import { RunResultsArtifact } from "dbt-artifacts-parser/run_results";
import { FreshnessExecutionResultArtifact } from "dbt-artifacts-parser/sources";
```

#### 2. Version-Specific Imports

Import specific versions when you need exact type control:

```typescript
import { Manifest } from "dbt-artifacts-parser/manifest/v1";
import { WritableManifest } from "dbt-artifacts-parser/manifest/v12";
import { RunResults } from "dbt-artifacts-parser/run_results/v1";
import { RunResultsArtifact } from "dbt-artifacts-parser/run_results/v6";
```

#### 3. Namespaced Imports

Import all categories as namespaces:

```typescript
import { catalog, manifest, run_results, sources } from 'dbt-artifacts-parser';

// Access types
const catalogType: catalog.CatalogArtifact = { ... };
const manifestType: manifest.WritableManifest = { ... };

// Access parser functions
const parsed = manifest.parseManifest(manifestJson);
```

### Parsing Artifacts

#### Automatic Version Detection

The main parse functions automatically detect the artifact version and return the appropriately typed object:

```typescript
import { parseManifest } from "dbt-artifacts-parser/manifest";
import { parseCatalog } from "dbt-artifacts-parser/catalog";
import { parseRunResults } from "dbt-artifacts-parser/run_results";
import { parseSources } from "dbt-artifacts-parser/sources";
import fs from "fs";

// Parse manifest.json
const manifestJson = JSON.parse(fs.readFileSync("manifest.json", "utf-8"));
const manifest = parseManifest(manifestJson);
// Returns: ParsedManifest (union of all manifest versions)
// TypeScript will infer the correct type based on metadata.dbt_schema_version

// Parse catalog.json
const catalogJson = JSON.parse(fs.readFileSync("catalog.json", "utf-8"));
const catalog = parseCatalog(catalogJson);
// Returns: ParsedCatalog

// Parse run-results.json
const runResultsJson = JSON.parse(fs.readFileSync("run-results.json", "utf-8"));
const runResults = parseRunResults(runResultsJson);
// Returns: ParsedRunResults

// Parse sources.json
const sourcesJson = JSON.parse(fs.readFileSync("sources.json", "utf-8"));
const sources = parseSources(sourcesJson);
// Returns: ParsedSources
```

#### Version-Specific Parsing

For explicit version control, use version-specific parsers:

```typescript
import {
  parseManifestV1,
  parseManifestV12,
} from "dbt-artifacts-parser/manifest";
import { parseRunResultsV6 } from "dbt-artifacts-parser/run_results";
import { parseCatalogV1 } from "dbt-artifacts-parser/catalog";
import { parseSourcesV3 } from "dbt-artifacts-parser/sources";

// Parse with explicit version (validates version matches)
const manifestV1 = parseManifestV1(manifestJson); // Returns: ManifestV1
const manifestV12 = parseManifestV12(manifestJson); // Returns: WritableManifestV12
const runResultsV6 = parseRunResultsV6(runResultsJson); // Returns: RunResultsArtifactV6
const catalogV1 = parseCatalogV1(catalogJson); // Returns: CatalogArtifactV1
const sourcesV3 = parseSourcesV3(sourcesJson); // Returns: FreshnessExecutionResultArtifactV3
```

#### Using Namespaced Imports

```typescript
import { manifest, catalog, run_results, sources } from "dbt-artifacts-parser";

// Parse using namespaced functions
const manifest = manifest.parseManifest(manifestJson);
const catalog = catalog.parseCatalog(catalogJson);
const runResults = run_results.parseRunResults(runResultsJson);
const sourcesData = sources.parseSources(sourcesJson);
```

### Type Usage

#### Union Types

The library exports union types that represent all versions of each artifact:

```typescript
import type { ParsedManifest } from "dbt-artifacts-parser/manifest";
import type { ParsedCatalog } from "dbt-artifacts-parser/catalog";
import type { ParsedRunResults } from "dbt-artifacts-parser/run_results";
import type { ParsedSources } from "dbt-artifacts-parser/sources";

function processManifest(manifest: ParsedManifest) {
  // TypeScript knows manifest has metadata, nodes, sources, etc.
  console.log(manifest.metadata.dbt_schema_version);
  console.log(Object.keys(manifest.nodes));
}

function processCatalog(catalog: ParsedCatalog) {
  console.log(catalog.metadata.dbt_schema_version);
  console.log(Object.keys(catalog.nodes));
}
```

#### Versioned Type Exports

Import specific version types with version suffixes:

```typescript
import type {
  ManifestV1,
  ManifestV2,
  WritableManifestV12,
} from "dbt-artifacts-parser/manifest";
import type {
  RunResultsV1,
  RunResultsArtifactV6,
} from "dbt-artifacts-parser/run_results";
import type { CatalogArtifactV1 } from "dbt-artifacts-parser/catalog";
import type { SourcesV1, SourceV3 } from "dbt-artifacts-parser/sources";

// Use specific version types
function handleV1Manifest(manifest: ManifestV1) {
  // TypeScript knows this is specifically v1
}
```

## Supported Versions

### Manifest

- **v1-v2**: `Manifest` interface
- **v3-v10**: Generated schema interfaces (`HttpsSchemasGetdbtComDbtManifestV{N}Json`)
- **v11-v12**: `WritableManifest` interface
- **Latest**: v12 (`WritableManifest`)

### Catalog

- **v1**: `CatalogArtifact` interface
- **Latest**: v1

### RunResults

- **v1-v2**: `RunResults` interface
- **v3-v4**: Generated schema interfaces (`HttpsSchemasGetdbtComDbtRunResultsV{N}Json`)
- **v5-v6**: `RunResultsArtifact` interface
- **Latest**: v6 (`RunResultsArtifact`)

### Sources

- **v1**: `Sources` interface
- **v2**: Generated schema interface (`HttpsSchemasGetdbtComDbtSourcesV2Json`)
- **v3**: `FreshnessExecutionResultArtifact` interface
- **Latest**: v3 (`FreshnessExecutionResultArtifact`)

## API Reference

### Manifest Parsers

#### `parseManifest(manifest: Record<string, unknown>): ParsedManifest`

Automatically detects version and returns typed manifest.

**Throws**: `Error` if manifest is invalid or version is unsupported

#### `parseManifestV1(manifest: Record<string, unknown>): ManifestV1`

#### `parseManifestV2(manifest: Record<string, unknown>): ManifestV2`

#### `parseManifestV3(manifest: Record<string, unknown>): ManifestV3`

#### ... (v4 through v12)

Version-specific parsers that validate the version matches before returning.

**Throws**: `Error` with message "Not a manifest.json v{N}" if version doesn't match

### Catalog Parsers

#### `parseCatalog(catalog: Record<string, unknown>): ParsedCatalog`

Automatically detects version and returns typed catalog.

**Throws**: `Error` if catalog is invalid or version is unsupported

#### `parseCatalogV1(catalog: Record<string, unknown>): CatalogArtifactV1`

Version-specific parser for catalog v1.

### RunResults Parsers

#### `parseRunResults(runResults: Record<string, unknown>): ParsedRunResults`

Automatically detects version and returns typed run results.

**Throws**: `Error` if run results is invalid or version is unsupported

#### `parseRunResultsV1(runResults: Record<string, unknown>): RunResultsV1`

#### `parseRunResultsV2(runResults: Record<string, unknown>): RunResultsV2`

#### ... (v3 through v6)

Version-specific parsers for run results.

### Sources Parsers

#### `parseSources(sources: Record<string, unknown>): ParsedSources`

Automatically detects version and returns typed sources.

**Throws**: `Error` if sources is invalid or version is unsupported

#### `parseSourcesV1(sources: Record<string, unknown>): SourcesV1`

#### `parseSourcesV2(sources: Record<string, unknown>): SourcesV2`

#### `parseSourcesV3(sources: Record<string, unknown>): SourceV3`

Version-specific parsers for sources.

## Error Handling

All parser functions throw descriptive errors:

- **Invalid structure**: `"Not a {artifact}.json"` - when the input doesn't have required metadata
- **Wrong version**: `"Not a {artifact}.json v{N}"` - when using version-specific parser with wrong version
- **Unsupported version**: `"Unsupported {artifact} version: {version}"` - when version is not supported

```typescript
try {
  const manifest = parseManifest(invalidJson);
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message); // "Not a manifest.json"
  }
}
```

## Development

### Building

```bash
pnpm build
```

### Running Tests

```bash
pnpm test
```

### Generating Types

Types are generated from JSON Schema files. To regenerate:

```bash
pnpm gen:types
```

### Project Structure

```text
packages/dbt-artifacts-parser/
├── src/
│   ├── catalog/          # Catalog artifact types and parsers
│   ├── manifest/          # Manifest artifact types and parsers
│   ├── run_results/      # RunResults artifact types and parsers
│   ├── sources/           # Sources artifact types and parsers
│   └── index.ts           # Main entry point
├── resources/            # JSON Schema source files
└── scripts/              # Type generation scripts
```

## License

Licensed under the Apache License, Version 2.0. See LICENSE file for details.

## Related Projects

This library is inspired by and provides TypeScript equivalents to the Python [dbt-artifacts-parser](https://github.com/yu-iskw/dbt-artifacts-parser) library.
