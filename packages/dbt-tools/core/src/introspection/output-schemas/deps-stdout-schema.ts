import { JSON_SCHEMA_DRAFT_URL } from "./json-schema-version";

/**
 * JSON Schema for deps command stdout when emitting JSON.
 * Tree format nests `dependencies`; flat list uses the same top-level keys.
 */
export const depsStdoutJsonSchema = {
  $schema: JSON_SCHEMA_DRAFT_URL,
  $id: "https://dbt-tools.dev/schemas/cli/deps.stdout.json",
  title: "dbt-tools deps JSON stdout",
  type: "object",
  additionalProperties: true,
  properties: {
    resource_id: { type: "string" },
    direction: { type: "string", enum: ["upstream", "downstream"] },
    count: { type: "integer", minimum: 0 },
    dependencies: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
  },
  required: ["resource_id", "direction", "dependencies", "count"],
} as const;
