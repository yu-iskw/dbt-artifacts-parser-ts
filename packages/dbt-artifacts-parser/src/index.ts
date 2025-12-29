// Copyright 2025 yu-iskw
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// dbt-artifacts-parser
//
// Import from specific categories to avoid naming conflicts:
//   import { WritableManifest } from 'dbt-artifacts-parser/manifest'
//   import { WritableManifest } from 'dbt-artifacts-parser/manifest/v12' (for specific version)
//   import { CatalogArtifact } from 'dbt-artifacts-parser/catalog'
//   import { RunResultsArtifact } from 'dbt-artifacts-parser/run_results'
//   import { FreshnessExecutionResultArtifact } from 'dbt-artifacts-parser/sources'

// Re-export catalog (latest version)
export * from "./catalog";
