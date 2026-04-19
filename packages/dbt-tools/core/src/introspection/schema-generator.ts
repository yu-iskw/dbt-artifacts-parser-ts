/**
 * Command schema definition for runtime introspection
 */
export interface CommandSchema {
  command: string;
  description: string;
  stability: "core" | "evolving" | "experimental";
  schema_version: string;
  arguments: Array<{
    name: string;
    required: boolean;
    description: string;
  }>;
  options: Array<{
    name: string;
    type: string;
    values?: string[];
    default?: string;
    description: string;
  }>;
  output_format: string;
  example: string;
}

type SchemaOption = {
  name: string;
  type: string;
  values?: string[];
  default?: string;
  description: string;
};

const OPT_DBT_TARGET = "--dbt-target";
const OPT_JSON = "--json";
const OPT_NO_JSON = "--no-json";
const TYPE_STRING = "string";
const TYPE_BOOLEAN = "boolean";
const OUTPUT_JSON_OR_HUMAN = "json or human-readable";
const DESC_DBT_TARGET =
  "Directory containing manifest.json + run_results.json, or s3://bucket/prefix / gs://bucket/prefix. When omitted, uses DBT_TOOLS_DBT_TARGET if set.";
const DESC_FORCE_JSON =
  "Force JSON stdout; with --json, errors on stderr use structured JSON";
const DESC_FORCE_HUMAN = "Force human-readable output";
const DESC_FIELDS =
  "Comma-separated list of fields to include in response (e.g., unique_id,name)";

function getArtifactRootCliSchemaOptions(): SchemaOption[] {
  return [
    {
      name: OPT_DBT_TARGET,
      type: TYPE_STRING,
      description: DESC_DBT_TARGET,
    },
  ];
}

function getSummarySchema(): CommandSchema {
  return {
    command: "summary",
    description: "Provide summary statistics for dbt manifest",
    stability: "core",
    schema_version: "1.0",
    arguments: [],
    options: [
      {
        name: "--fields",
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      {
        name: OPT_JSON,
        type: TYPE_BOOLEAN,
        description: DESC_FORCE_JSON,
      },
      {
        name: OPT_NO_JSON,
        type: TYPE_BOOLEAN,
        description: DESC_FORCE_HUMAN,
      },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: "dbt-tools summary --dbt-target ./target",
  };
}

function getGraphSchema(): CommandSchema {
  return {
    command: "graph",
    description: "Export dependency graph in various formats",
    stability: "core",
    schema_version: "1.0",
    arguments: [],
    options: [
      {
        name: "--format",
        type: "enum",
        values: ["json", "dot", "gexf"],
        default: "json",
        description: "Export format",
      },
      {
        name: "--output",
        type: TYPE_STRING,
        description: "Output file path (default: stdout)",
      },
      {
        name: "--fields",
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      {
        name: "--field-level",
        type: TYPE_BOOLEAN,
        description: "Include field-level (column-level) lineage",
      },
      {
        name: "--focus",
        type: TYPE_STRING,
        description:
          "Focus on a single node (unique_id); exports only its subgraph",
      },
      {
        name: "--focus-depth",
        type: "number",
        description: "Max traversal hops for --focus (default: unlimited)",
      },
      {
        name: "--focus-direction",
        type: "enum",
        values: ["upstream", "downstream", "both"],
        default: "both",
        description: "Traversal direction for --focus",
      },
      {
        name: "--resource-types",
        type: TYPE_STRING,
        description:
          "Comma-separated resource types to keep in the subgraph (e.g. model,test); focus node is always included",
      },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: "json, dot, or gexf",
    example: "dbt-tools graph --focus model.my_project.orders --focus-depth 2",
  };
}

function getRunReportSchema(): CommandSchema {
  return {
    command: "run-report",
    description: "Generate execution report from run_results.json",
    stability: "core",
    schema_version: "1.0",
    arguments: [],
    options: [
      {
        name: "--fields",
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      {
        name: "--bottlenecks",
        type: TYPE_BOOLEAN,
        description: "Include bottleneck section in report",
      },
      {
        name: "--bottlenecks-top",
        type: "number",
        default: "10",
        description: "Top N slowest nodes (default: 10 when --bottlenecks)",
      },
      {
        name: "--bottlenecks-threshold",
        type: "number",
        description: "Nodes exceeding N seconds (alternative to top-N)",
      },
      {
        name: "--adapter-summary",
        type: TYPE_BOOLEAN,
        description:
          "Include adapter_response aggregates (human default top-5 slot/bytes)",
      },
      {
        name: "--adapter-top-by",
        type: TYPE_STRING,
        values: ["bytes_processed", "slot_ms", "rows_affected"],
        description: "Rank nodes by adapter metric",
      },
      {
        name: "--adapter-top-n",
        type: "number",
        default: "10",
        description: "Top N for --adapter-top-by",
      },
      {
        name: "--adapter-min-bytes",
        type: "number",
        description: "With --adapter-top-by, require bytes_processed >= n",
      },
      {
        name: "--adapter-min-slot-ms",
        type: "number",
        description: "With --adapter-top-by, require slot_ms >= n",
      },
      {
        name: OPT_JSON,
        type: TYPE_BOOLEAN,
        description: DESC_FORCE_JSON,
      },
      {
        name: OPT_NO_JSON,
        type: TYPE_BOOLEAN,
        description: DESC_FORCE_HUMAN,
      },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: "dbt-tools run-report --dbt-target ./target --bottlenecks",
  };
}

function getDepsSchemaOptions(): SchemaOption[] {
  return [
    {
      name: "--direction",
      type: "enum",
      values: ["upstream", "downstream"],
      default: "downstream",
      description: "Direction of dependency traversal",
    },
    {
      name: "--fields",
      type: TYPE_STRING,
      description: DESC_FIELDS,
    },
    {
      name: "--field",
      type: TYPE_STRING,
      description: "Specific field (column) to trace dependencies for",
    },
    {
      name: "--depth",
      type: "number",
      description:
        "Max traversal depth; 1 = immediate neighbors, omit for all levels",
    },
    {
      name: "--format",
      type: "enum",
      values: ["flat", "tree"],
      default: "tree",
      description: "Output structure: flat list or nested tree",
    },
    {
      name: "--build-order",
      type: TYPE_BOOLEAN,
      description:
        "Output upstream dependencies in topological build order (only with --direction upstream)",
    },
    { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
    { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
    ...getArtifactRootCliSchemaOptions(),
  ];
}

function getDepsSchema(): CommandSchema {
  return {
    command: "deps",
    description: "Get upstream or downstream dependencies for a dbt resource",
    stability: "core",
    schema_version: "1.0",
    arguments: [
      {
        name: "resource-id",
        required: true,
        description:
          "Unique ID of the dbt resource (e.g., model.my_project.customers)",
      },
    ],
    options: getDepsSchemaOptions(),
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: "dbt-tools deps model.my_project.customers --direction downstream",
  };
}

function getSchemaCommandSchema(): CommandSchema {
  return {
    command: "schema",
    description: "Get machine-readable schema for a command",
    stability: "core",
    schema_version: "1.0",
    arguments: [
      {
        name: "command",
        required: false,
        description: "Command name (if omitted, returns all command schemas)",
      },
    ],
    options: [
      {
        name: OPT_JSON,
        type: TYPE_BOOLEAN,
        description: DESC_FORCE_JSON,
      },
    ],
    output_format: "json",
    example: "dbt-tools schema deps",
  };
}

/**
 * Get schema for a specific command
 */
export function getCommandSchema(command: string): CommandSchema | null {
  const schemas = getAllSchemas();
  return schemas[command] || null;
}

function getInventorySchema(): CommandSchema {
  return {
    command: "inventory",
    description: "List and filter dbt resources from manifest",
    stability: "core",
    schema_version: "1.0",
    arguments: [],
    options: [
      {
        name: "--type",
        type: TYPE_STRING,
        description:
          "Filter by resource type(s), comma-separated (e.g. model,test)",
      },
      {
        name: "--package",
        type: TYPE_STRING,
        description: "Filter by package name",
      },
      {
        name: "--tag",
        type: TYPE_STRING,
        description: "Filter by tag(s), comma-separated",
      },
      {
        name: "--path",
        type: TYPE_STRING,
        description: "Filter by file path substring",
      },
      {
        name: "--fields",
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example:
      "dbt-tools inventory --dbt-target ./target --type model --tag finance",
  };
}

function getTimelineSchema(): CommandSchema {
  return {
    command: "timeline",
    description:
      "Show per-node execution timeline from run_results.json (row-level entries, unlike run-report)",
    stability: "core",
    schema_version: "1.0",
    arguments: [],
    options: [
      {
        name: "--sort",
        type: "enum",
        values: ["duration", "start"],
        default: "duration",
        description: "Sort order for entries",
      },
      {
        name: "--top",
        type: "number",
        description: "Show top N entries only",
      },
      {
        name: "--failed-only",
        type: TYPE_BOOLEAN,
        description: "Show only non-successful executions",
      },
      {
        name: "--status",
        type: TYPE_STRING,
        description: "Filter by status (comma-separated, e.g. error,warn)",
      },
      {
        name: "--format",
        type: "enum",
        values: ["json", "table", "csv"],
        description: "Output format (default: json in non-TTY, table in TTY)",
      },
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: "json, table, or csv",
    example:
      "dbt-tools timeline --dbt-target ./target --sort duration --top 20 --failed-only",
  };
}

function getSearchSchema(): CommandSchema {
  return {
    command: "search",
    description: "Search for dbt resources by name, tag, type, or free text",
    stability: "core",
    schema_version: "1.0",
    arguments: [
      {
        name: "query",
        required: false,
        description:
          "Search query; supports key:value tokens like type:model tag:finance",
      },
    ],
    options: [
      {
        name: "--type",
        type: TYPE_STRING,
        description: "Filter by resource type(s), comma-separated",
      },
      {
        name: "--package",
        type: TYPE_STRING,
        description: "Filter by package name",
      },
      {
        name: "--tag",
        type: TYPE_STRING,
        description: "Filter by tag(s), comma-separated",
      },
      {
        name: "--path",
        type: TYPE_STRING,
        description: "Filter by file path substring",
      },
      {
        name: "--fields",
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: "dbt-tools search --dbt-target ./target orders",
  };
}

function getStatusSchema(): CommandSchema {
  return {
    command: "status",
    description:
      "Report dbt artifact presence, modification times, and analysis readiness",
    stability: "core",
    schema_version: "1.0",
    arguments: [],
    options: [
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: "dbt-tools status --dbt-target ./target",
  };
}

function getDiscoverSchema(): CommandSchema {
  return {
    command: "discover",
    description: "Intent-oriented discovery across dbt resources",
    stability: "core",
    schema_version: "1.0",
    arguments: [
      {
        name: "query",
        required: true,
        description: "Ambiguous query or resource reference",
      },
    ],
    options: [
      {
        name: "--type",
        type: TYPE_STRING,
        description: "Filter by resource type(s), comma-separated",
      },
      { name: "--limit", type: "number", description: "Max discovery matches" },
      {
        name: "--fields",
        type: TYPE_STRING,
        description: DESC_FIELDS,
      },
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: "dbt-tools discover orders --json",
  };
}

function getExplainSchema(): CommandSchema {
  return {
    command: "explain",
    description: "Intent-oriented explanation for a dbt resource",
    stability: "evolving",
    schema_version: "1.0",
    arguments: [
      {
        name: "resource",
        required: true,
        description: "Resource query or unique_id",
      },
    ],
    options: [
      { name: "--fields", type: TYPE_STRING, description: DESC_FIELDS },
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: "dbt-tools explain orders --json",
  };
}

function getImpactSchema(): CommandSchema {
  return {
    command: "impact",
    description: "Intent-oriented upstream/downstream impact analysis",
    stability: "evolving",
    schema_version: "1.0",
    arguments: [
      {
        name: "resource",
        required: true,
        description: "Resource query or unique_id",
      },
    ],
    options: [
      { name: "--fields", type: TYPE_STRING, description: DESC_FIELDS },
      { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
      { name: OPT_NO_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_HUMAN },
      ...getArtifactRootCliSchemaOptions(),
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: "dbt-tools impact orders --json",
  };
}

/**
 * Get all command schemas
 */
export function getAllSchemas(): Record<string, CommandSchema> {
  return {
    summary: getSummarySchema(),
    graph: getGraphSchema(),
    "run-report": getRunReportSchema(),
    deps: getDepsSchema(),
    inventory: getInventorySchema(),
    timeline: getTimelineSchema(),
    search: getSearchSchema(),
    status: getStatusSchema(),
    discover: getDiscoverSchema(),
    explain: getExplainSchema(),
    impact: getImpactSchema(),
    freshness: {
      ...getStatusSchema(),
      command: "freshness",
      description: "Alias for status – shows artifact recency and readiness",
      example: "dbt-tools freshness --dbt-target ./target",
    },
    schema: getSchemaCommandSchema(),
  };
}
