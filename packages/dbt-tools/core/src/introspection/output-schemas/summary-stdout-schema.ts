import { JSON_SCHEMA_DRAFT_URL } from "./json-schema-version";

/**
 * JSON Schema for summary command stdout when emitting JSON (--json or non-TTY).
 */
export const summaryStdoutJsonSchema = {
  $schema: JSON_SCHEMA_DRAFT_URL,
  $id: "https://dbt-tools.dev/schemas/cli/summary.stdout.json",
  title: "dbt-tools summary JSON stdout",
  type: "object",
  additionalProperties: true,
  properties: {
    total_nodes: { type: "integer", minimum: 0 },
    total_edges: { type: "integer", minimum: 0 },
    has_cycles: { type: "boolean" },
    nodes_by_type: {
      type: "object",
      additionalProperties: { type: "integer", minimum: 0 },
    },
  },
  required: ["total_nodes", "total_edges", "has_cycles", "nodes_by_type"],
} as const;
