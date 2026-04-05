import { GRAPH_RISK_RANKING_METRICS } from "../analysis/graph-risk-config";

/**
 * Command schema definition for runtime introspection
 */
export interface CommandSchema {
  command: string;
  description: string;
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

const ARG_MANIFEST_PATH = "manifest-path";
const OPT_TARGET_DIR = "--target-dir";
const OPT_JSON = "--json";
const OPT_NO_JSON = "--no-json";
const TYPE_STRING = "string";
const TYPE_BOOLEAN = "boolean";
const OUTPUT_JSON_OR_HUMAN = "json or human-readable";
const DESC_MANIFEST_PATH =
  "Path to manifest.json file (defaults to ./target/manifest.json)";
const DESC_TARGET_DIR = "Custom target directory (defaults to ./target)";
const DESC_FORCE_JSON = "Force JSON output";
const DESC_FORCE_HUMAN = "Force human-readable output";
const DESC_FIELDS =
  "Comma-separated list of fields to include in response (e.g., unique_id,name)";
const DESC_RUN_RESULTS_PATH =
  "Path to run_results.json file (defaults to ./target/run_results.json)";
const DESC_MANIFEST_OPTIONAL =
  "Path to manifest.json file (optional, for critical path analysis)";
const DESC_RUN_RESULTS_OPTIONAL =
  "Optional path to run_results.json file for execution-aware scoring";

function getSummarySchema(): CommandSchema {
  return {
    command: "summary",
    description: "Provide summary statistics for dbt manifest",
    arguments: [
      {
        name: ARG_MANIFEST_PATH,
        required: false,
        description: DESC_MANIFEST_PATH,
      },
    ],
    options: [
      {
        name: OPT_TARGET_DIR,
        type: TYPE_STRING,
        description: DESC_TARGET_DIR,
      },
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
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: "dbt-tools summary",
  };
}

function getGraphSchema(): CommandSchema {
  return {
    command: "graph",
    description: "Export dependency graph in various formats",
    arguments: [
      {
        name: ARG_MANIFEST_PATH,
        required: false,
        description: DESC_MANIFEST_PATH,
      },
    ],
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
        name: OPT_TARGET_DIR,
        type: TYPE_STRING,
        description: DESC_TARGET_DIR,
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
        name: "--catalog-path",
        type: TYPE_STRING,
        description: "Path to catalog.json file",
      },
    ],
    output_format: "json, dot, or gexf",
    example: "dbt-tools graph --format dot --output graph.dot",
  };
}

function getRunReportSchema(): CommandSchema {
  return {
    command: "run-report",
    description: "Generate execution report from run_results.json",
    arguments: [
      {
        name: "run-results-path",
        required: false,
        description: DESC_RUN_RESULTS_PATH,
      },
      {
        name: ARG_MANIFEST_PATH,
        required: false,
        description: DESC_MANIFEST_OPTIONAL,
      },
    ],
    options: [
      {
        name: OPT_TARGET_DIR,
        type: TYPE_STRING,
        description: DESC_TARGET_DIR,
      },
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
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: "dbt-tools run-report --bottlenecks",
  };
}

function getGraphRiskSchema(): CommandSchema {
  return {
    command: "graph-risk",
    description:
      "Rank structural and execution-aware graph risk from dbt artifacts",
    arguments: [
      {
        name: ARG_MANIFEST_PATH,
        required: false,
        description: DESC_MANIFEST_PATH,
      },
    ],
    options: [
      {
        name: OPT_TARGET_DIR,
        type: TYPE_STRING,
        description: DESC_TARGET_DIR,
      },
      {
        name: "--run-results",
        type: TYPE_STRING,
        description: DESC_RUN_RESULTS_OPTIONAL,
      },
      {
        name: "--top",
        type: "number",
        default: "10",
        description: "Top N nodes to return per ranking",
      },
      {
        name: "--metric",
        type: "enum",
        values: [...GRAPH_RISK_RANKING_METRICS],
        default: "overallRiskScore",
        description: "Ranking metric",
      },
      {
        name: "--resource-types",
        type: TYPE_STRING,
        description: "Comma-separated resource types to analyze",
      },
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
    ],
    output_format: OUTPUT_JSON_OR_HUMAN,
    example: "dbt-tools graph-risk --run-results ./target/run_results.json",
  };
}

type SchemaOption = {
  name: string;
  type: string;
  values?: string[];
  default?: string;
  description: string;
};

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
      name: "--manifest-path",
      type: TYPE_STRING,
      default: "./target/manifest.json",
      description: "Path to manifest.json file",
    },
    {
      name: OPT_TARGET_DIR,
      type: TYPE_STRING,
      description: DESC_TARGET_DIR,
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
      name: "--catalog-path",
      type: TYPE_STRING,
      description: "Path to catalog.json file",
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
  ];
}

function getDepsSchema(): CommandSchema {
  return {
    command: "deps",
    description: "Get upstream or downstream dependencies for a dbt resource",
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

/**
 * Get all command schemas
 */
export function getAllSchemas(): Record<string, CommandSchema> {
  return {
    summary: getSummarySchema(),
    graph: getGraphSchema(),
    "graph-risk": getGraphRiskSchema(),
    "run-report": getRunReportSchema(),
    deps: getDepsSchema(),
    schema: getSchemaCommandSchema(),
  };
}
