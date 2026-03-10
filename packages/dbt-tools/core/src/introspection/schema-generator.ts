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

/**
 * SchemaGenerator provides runtime command introspection for agents
 */
export class SchemaGenerator {
  /**
   * Get schema for a specific command
   */
  static getCommandSchema(command: string): CommandSchema | null {
    const schemas = this.getAllSchemas();
    return schemas[command] || null;
  }

  /**
   * Get all command schemas
   */
  static getAllSchemas(): Record<string, CommandSchema> {
    return {
      analyze: {
        command: "analyze",
        description: "Analyze dbt manifest and provide summary statistics",
        arguments: [
          {
            name: "manifest-path",
            required: false,
            description:
              "Path to manifest.json file (defaults to ./target/manifest.json)",
          },
        ],
        options: [
          {
            name: "--target-dir",
            type: "string",
            description: "Custom target directory (defaults to ./target)",
          },
          {
            name: "--json",
            type: "boolean",
            description: "Force JSON output",
          },
          {
            name: "--no-json",
            type: "boolean",
            description: "Force human-readable output",
          },
        ],
        output_format: "json or human-readable",
        example: "dbt-tools analyze",
      },
      graph: {
        command: "graph",
        description: "Export dependency graph in various formats",
        arguments: [
          {
            name: "manifest-path",
            required: false,
            description:
              "Path to manifest.json file (defaults to ./target/manifest.json)",
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
            type: "string",
            description: "Output file path (default: stdout)",
          },
          {
            name: "--target-dir",
            type: "string",
            description: "Custom target directory (defaults to ./target)",
          },
        ],
        output_format: "json, dot, or gexf",
        example: "dbt-tools graph --format dot --output graph.dot",
      },
      "run-report": {
        command: "run-report",
        description: "Generate execution report from run_results.json",
        arguments: [
          {
            name: "run-results-path",
            required: false,
            description:
              "Path to run_results.json file (defaults to ./target/run_results.json)",
          },
          {
            name: "manifest-path",
            required: false,
            description:
              "Path to manifest.json file (optional, for critical path analysis)",
          },
        ],
        options: [
          {
            name: "--target-dir",
            type: "string",
            description: "Custom target directory (defaults to ./target)",
          },
          {
            name: "--json",
            type: "boolean",
            description: "Force JSON output",
          },
          {
            name: "--no-json",
            type: "boolean",
            description: "Force human-readable output",
          },
        ],
        output_format: "json or human-readable",
        example: "dbt-tools run-report",
      },
      deps: {
        command: "deps",
        description:
          "Get upstream or downstream dependencies for a dbt resource",
        arguments: [
          {
            name: "resource-id",
            required: true,
            description:
              "Unique ID of the dbt resource (e.g., model.my_project.customers)",
          },
        ],
        options: [
          {
            name: "--direction",
            type: "enum",
            values: ["upstream", "downstream"],
            default: "downstream",
            description: "Direction of dependency traversal",
          },
          {
            name: "--manifest-path",
            type: "string",
            default: "./target/manifest.json",
            description: "Path to manifest.json file",
          },
          {
            name: "--target-dir",
            type: "string",
            description: "Custom target directory (defaults to ./target)",
          },
          {
            name: "--fields",
            type: "string",
            description:
              "Comma-separated list of fields to include in response (e.g., unique_id,name)",
          },
          {
            name: "--json",
            type: "boolean",
            description: "Force JSON output",
          },
          {
            name: "--no-json",
            type: "boolean",
            description: "Force human-readable output",
          },
        ],
        output_format: "json or human-readable",
        example:
          "dbt-tools deps model.my_project.customers --direction downstream",
      },
      schema: {
        command: "schema",
        description: "Get machine-readable schema for a command",
        arguments: [
          {
            name: "command",
            required: false,
            description:
              "Command name (if omitted, returns all command schemas)",
          },
        ],
        options: [
          {
            name: "--json",
            type: "boolean",
            description: "Force JSON output (always JSON by default)",
          },
        ],
        output_format: "json",
        example: "dbt-tools schema deps",
      },
    };
  }
}
