/**
 * Command schema definition for runtime introspection.
 *
 * The schema is hierarchical so the CLI can expose both human-friendly
 * grouped help and machine-readable discovery for command families and leaves.
 */
export interface CommandSchema {
  kind: "root" | "group" | "command";
  command: string;
  path: string[];
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
  subcommands?: Record<string, CommandSchema>;
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

type SchemaOption = {
  name: string;
  type: string;
  values?: string[];
  default?: string;
  description: string;
};

function createSchemaNode(
  kind: "root" | "group" | "command",
  path: string[],
  description: string,
  config: {
    arguments?: CommandSchema["arguments"];
    options?: CommandSchema["options"];
    outputFormat?: string;
    example?: string;
    subcommands?: Record<string, CommandSchema>;
  } = {},
): CommandSchema {
  return {
    kind,
    command: path.join(" "),
    path,
    description,
    arguments: config.arguments ?? [],
    options: config.options ?? [],
    output_format: config.outputFormat ?? "n/a",
    example: config.example ?? `dbt-tools ${path.join(" ")}`.trim(),
    subcommands: config.subcommands,
  };
}

function getSummarySchema(path: string[]): CommandSchema {
  return createSchemaNode(
    "command",
    path,
    "Provide manifest-level summary statistics",
    {
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
      outputFormat: OUTPUT_JSON_OR_HUMAN,
      example: "dbt-tools inspect summary",
    },
  );
}

function getGraphSchema(path: string[]): CommandSchema {
  return createSchemaNode("command", path, "Export dependency graph", {
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
    ],
    outputFormat: "json, dot, or gexf",
    example:
      "dbt-tools export graph --focus model.my_project.orders --focus-depth 2",
  });
}

function getRunReportSchema(path: string[]): CommandSchema {
  return createSchemaNode(
    "command",
    path,
    "Inspect aggregated execution report from run_results.json",
    {
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
          type: "enum",
          values: [
            "bytes_processed",
            "bytes_billed",
            "slot_ms",
            "rows_affected",
            "rows_inserted",
            "rows_updated",
            "rows_deleted",
            "rows_duplicated",
          ],
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
          name: "--adapter-min-rows-affected",
          type: "number",
          description: "With --adapter-top-by, require rows_affected >= n",
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
      outputFormat: OUTPUT_JSON_OR_HUMAN,
      example: "dbt-tools inspect run --bottlenecks",
    },
  );
}

function getLineageSchemaOptions(): SchemaOption[] {
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

function getLineageSchema(path: string[]): CommandSchema {
  return createSchemaNode(
    "command",
    path,
    "Trace upstream or downstream lineage from a dbt resource",
    {
      arguments: [
        {
          name: "resource-id",
          required: true,
          description:
            "Unique ID of the dbt resource (e.g., model.my_project.customers)",
        },
      ],
      options: getLineageSchemaOptions(),
      outputFormat: OUTPUT_JSON_OR_HUMAN,
      example:
        "dbt-tools trace lineage model.my_project.customers --direction downstream",
    },
  );
}

function getInventorySchema(path: string[]): CommandSchema {
  return createSchemaNode(
    "command",
    path,
    "Inspect inventory by enumerating and filtering manifest resources",
    {
      arguments: [
        {
          name: ARG_MANIFEST_PATH,
          required: false,
          description: DESC_MANIFEST_PATH,
        },
      ],
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
        {
          name: OPT_TARGET_DIR,
          type: TYPE_STRING,
          description: DESC_TARGET_DIR,
        },
        { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
        {
          name: OPT_NO_JSON,
          type: TYPE_BOOLEAN,
          description: DESC_FORCE_HUMAN,
        },
      ],
      outputFormat: OUTPUT_JSON_OR_HUMAN,
      example: "dbt-tools inspect inventory --type model --tag finance",
    },
  );
}

function getTimelineSchema(path: string[]): CommandSchema {
  return createSchemaNode(
    "command",
    path,
    "Inspect row-level execution timeline entries from run_results.json",
    {
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
          name: "--sort",
          type: "enum",
          values: [
            "duration",
            "start",
            "query_id",
            "adapter_code",
            "adapter_message",
            "bytes_processed",
            "bytes_billed",
            "slot_ms",
            "rows_affected",
            "rows_inserted",
            "rows_updated",
            "rows_deleted",
            "rows_duplicated",
          ],
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
          name: "--adapter-text",
          type: TYPE_STRING,
          description:
            "Filter by normalized adapter text (query ID, code, message, location, project)",
        },
        {
          name: "--format",
          type: "enum",
          values: ["json", "table", "csv"],
          description: "Output format (default: json in non-TTY, table in TTY)",
        },
        {
          name: OPT_TARGET_DIR,
          type: TYPE_STRING,
          description: DESC_TARGET_DIR,
        },
        { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
        {
          name: OPT_NO_JSON,
          type: TYPE_BOOLEAN,
          description: DESC_FORCE_HUMAN,
        },
      ],
      outputFormat: "json, table, or csv",
      example:
        "dbt-tools inspect timeline --sort duration --top 20 --failed-only",
    },
  );
}

function getResourcesSchema(path: string[]): CommandSchema {
  return createSchemaNode(
    "command",
    path,
    "Discover likely resource matches from free text and filters",
    {
      arguments: [
        {
          name: "query",
          required: false,
          description:
            "Search query; supports key:value tokens like type:model tag:finance",
        },
        {
          name: ARG_MANIFEST_PATH,
          required: false,
          description: DESC_MANIFEST_PATH,
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
        {
          name: OPT_TARGET_DIR,
          type: TYPE_STRING,
          description: DESC_TARGET_DIR,
        },
        { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
        {
          name: OPT_NO_JSON,
          type: TYPE_BOOLEAN,
          description: DESC_FORCE_HUMAN,
        },
      ],
      outputFormat: OUTPUT_JSON_OR_HUMAN,
      example: "dbt-tools find resources orders",
    },
  );
}

function getArtifactsSchema(path: string[]): CommandSchema {
  return createSchemaNode(
    "command",
    path,
    "Check artifact presence, recency, and analysis readiness",
    {
      options: [
        {
          name: OPT_TARGET_DIR,
          type: TYPE_STRING,
          description: DESC_TARGET_DIR,
        },
        { name: OPT_JSON, type: TYPE_BOOLEAN, description: DESC_FORCE_JSON },
        {
          name: OPT_NO_JSON,
          type: TYPE_BOOLEAN,
          description: DESC_FORCE_HUMAN,
        },
      ],
      outputFormat: OUTPUT_JSON_OR_HUMAN,
      example: "dbt-tools check artifacts --target-dir ./target",
    },
  );
}

function getDescribeSchemaSchema(path: string[]): CommandSchema {
  return createSchemaNode(
    "command",
    path,
    "Get machine-readable schema for the full command tree or a specific path",
    {
      arguments: [
        {
          name: "command-path",
          required: false,
          description:
            "Optional command path segments (e.g. inspect run, trace lineage)",
        },
      ],
      options: [
        {
          name: OPT_JSON,
          type: TYPE_BOOLEAN,
          description: "Force JSON output (always JSON by default)",
        },
      ],
      outputFormat: "json",
      example: "dbt-tools describe schema inspect run",
    },
  );
}

function buildSchemaTree(): CommandSchema {
  const inspectPath = ["inspect"];
  const findPath = ["find"];
  const tracePath = ["trace"];
  const exportPath = ["export"];
  const checkPath = ["check"];
  const describePath = ["describe"];

  return createSchemaNode(
    "root",
    [],
    "Command-line interface for dbt artifact analysis",
    {
      example: "dbt-tools --help",
      subcommands: {
        inspect: createSchemaNode(
          "group",
          inspectPath,
          "Inspect dbt artifacts and derived analysis views",
          {
            subcommands: {
              summary: getSummarySchema([...inspectPath, "summary"]),
              run: getRunReportSchema([...inspectPath, "run"]),
              timeline: getTimelineSchema([...inspectPath, "timeline"]),
              inventory: getInventorySchema([...inspectPath, "inventory"]),
            },
          },
        ),
        find: createSchemaNode(
          "group",
          findPath,
          "Find likely matches before narrowing into a focused command",
          {
            subcommands: {
              resources: getResourcesSchema([...findPath, "resources"]),
            },
          },
        ),
        trace: createSchemaNode(
          "group",
          tracePath,
          "Trace lineage and traversal-based relationships",
          {
            subcommands: {
              lineage: getLineageSchema([...tracePath, "lineage"]),
            },
          },
        ),
        export: createSchemaNode(
          "group",
          exportPath,
          "Export dbt-derived structures for downstream tooling",
          {
            subcommands: {
              graph: getGraphSchema([...exportPath, "graph"]),
            },
          },
        ),
        check: createSchemaNode(
          "group",
          checkPath,
          "Check artifact availability and operational readiness",
          {
            subcommands: {
              artifacts: getArtifactsSchema([...checkPath, "artifacts"]),
            },
          },
        ),
        describe: createSchemaNode(
          "group",
          describePath,
          "Describe commands for human and machine discovery",
          {
            subcommands: {
              schema: getDescribeSchemaSchema([...describePath, "schema"]),
            },
          },
        ),
      },
    },
  );
}

function normalizeCommandPath(commandPath: string | string[]): string[] {
  const raw =
    typeof commandPath === "string"
      ? commandPath.trim().split(/\s+/).filter(Boolean)
      : commandPath;

  if (raw[0] === "dbt-tools") {
    return raw.slice(1);
  }

  return raw;
}

/**
 * Get schema for a specific command or command group path.
 */
export function getCommandSchema(
  commandPath: string | string[],
): CommandSchema | null {
  const normalizedPath = normalizeCommandPath(commandPath);
  const root = getAllSchemas();

  if (normalizedPath.length === 0) {
    return root;
  }

  let current: CommandSchema | undefined = root;
  for (const segment of normalizedPath) {
    current = current.subcommands?.[segment];
    if (!current) {
      return null;
    }
  }

  return current;
}

/**
 * Get the full hierarchical command schema tree.
 */
export function getAllSchemas(): CommandSchema {
  return buildSchemaTree();
}
