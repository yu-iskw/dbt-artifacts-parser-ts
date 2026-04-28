import { JSON_SCHEMA_DRAFT_URL } from "./json-schema-version";

const artifactStatus = {
  type: "object",
  additionalProperties: false,
  properties: {
    path: { type: "string" },
    exists: { type: "boolean" },
    modified_at: { type: "string" },
    age_seconds: { type: "integer", minimum: 0 },
  },
  required: ["path", "exists"],
} as const;

/**
 * JSON Schema for status / freshness command stdout when emitting JSON.
 */
export const statusStdoutJsonSchema = {
  $schema: JSON_SCHEMA_DRAFT_URL,
  $id: "https://dbt-tools.dev/schemas/cli/status.stdout.json",
  title: "dbt-tools status JSON stdout",
  type: "object",
  additionalProperties: false,
  properties: {
    target_dir: { type: "string" },
    manifest: artifactStatus,
    run_results: artifactStatus,
    catalog: artifactStatus,
    sources: artifactStatus,
    readiness: {
      type: "string",
      enum: ["manifest-only", "full", "unavailable"],
    },
    latest_modified_at: { type: "string" },
    age_seconds: { type: "integer", minimum: 0 },
    summary: { type: "string" },
  },
  required: [
    "target_dir",
    "manifest",
    "run_results",
    "catalog",
    "sources",
    "readiness",
    "summary",
  ],
} as const;
