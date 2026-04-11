import { describe, it, expect, vi } from "vitest";
import { Command } from "commander";
import {
  validateResourceId,
  validateSafePath,
  validateDepth,
  isTTY,
  formatOutput,
  formatDeps,
  formatSummary,
  getCommandSchema,
  getAllSchemas,
} from "@dbt-tools/core";
import { createProgram, run } from "./cli";

describe("CLI Integration", () => {
  describe("Core service integration", () => {
    it("should have input validation functions available", () => {
      expect(typeof validateResourceId).toBe("function");
      expect(typeof validateSafePath).toBe("function");
    });

    it("should have output formatting functions available", () => {
      expect(typeof isTTY).toBe("function");
      expect(typeof formatOutput).toBe("function");
    });

    it("should have schema introspection functions available", () => {
      expect(typeof getCommandSchema).toBe("function");
      expect(typeof getAllSchemas).toBe("function");
    });
  });

  describe("Command schema validation", () => {
    it("should have schema for all command families", () => {
      const schemas = getAllSchemas();
      expect(schemas.subcommands).toHaveProperty("inspect");
      expect(schemas.subcommands).toHaveProperty("find");
      expect(schemas.subcommands).toHaveProperty("trace");
      expect(schemas.subcommands).toHaveProperty("export");
      expect(schemas.subcommands).toHaveProperty("check");
      expect(schemas.subcommands).toHaveProperty("describe");
    });

    it("should have correct inspect inventory schema", () => {
      const schema = getCommandSchema("inspect inventory");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("inspect inventory");
      const typeOpt = schema?.options?.find((o) => o.name === "--type");
      expect(typeOpt).toBeDefined();
      const tagOpt = schema?.options?.find((o) => o.name === "--tag");
      expect(tagOpt).toBeDefined();
    });

    it("should have correct inspect timeline schema", () => {
      const schema = getCommandSchema("inspect timeline");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("inspect timeline");
      const sortOpt = schema?.options?.find((o) => o.name === "--sort");
      expect(sortOpt?.type).toBe("enum");
      const topOpt = schema?.options?.find((o) => o.name === "--top");
      expect(topOpt?.type).toBe("number");
    });

    it("should have correct find resources schema", () => {
      const schema = getCommandSchema("find resources");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("find resources");
      expect(schema?.arguments[0]?.name).toBe("query");
      expect(schema?.arguments[0]?.required).toBe(false);
    });

    it("should have correct check artifacts schema", () => {
      const schema = getCommandSchema("check artifacts");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("check artifacts");
      const targetDirOpt = schema?.options?.find(
        (o) => o.name === "--target-dir",
      );
      expect(targetDirOpt).toBeDefined();
    });

    it("should have correct trace lineage command schema", () => {
      const schema = getCommandSchema("trace lineage");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("trace lineage");
      expect(schema?.arguments.length).toBeGreaterThan(0);
      expect(schema?.arguments[0]?.name).toBe("resource-id");
      expect(schema?.arguments[0]?.required).toBe(true);

      const depthOpt = schema?.options?.find((o) => o.name === "--depth");
      expect(depthOpt).toBeDefined();
      expect(depthOpt?.type).toBe("number");

      const formatOpt = schema?.options?.find((o) => o.name === "--format");
      expect(formatOpt).toBeDefined();
      expect(formatOpt?.type).toBe("enum");
      expect(formatOpt?.values).toContain("flat");
      expect(formatOpt?.values).toContain("tree");

      const fieldOpt = schema?.options?.find((o) => o.name === "--field");
      expect(fieldOpt).toBeDefined();
      expect(fieldOpt?.type).toBe("string");
    });

    it("should have correct export graph command schema with field-level", () => {
      const schema = getCommandSchema("export graph");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("export graph");

      const fieldLevelOpt = schema?.options?.find(
        (o) => o.name === "--field-level",
      );
      expect(fieldLevelOpt).toBeDefined();
      expect(fieldLevelOpt?.type).toBe("boolean");

      const catalogOpt = schema?.options?.find(
        (o) => o.name === "--catalog-path",
      );
      expect(catalogOpt).toBeDefined();
      expect(catalogOpt?.type).toBe("string");
    });

    it("should have inspect run schema with bottleneck options", () => {
      const schema = getCommandSchema("inspect run");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("inspect run");

      const bottlenecksOpt = schema?.options?.find(
        (o) => o.name === "--bottlenecks",
      );
      expect(bottlenecksOpt).toBeDefined();
      expect(bottlenecksOpt?.type).toBe("boolean");

      const topOpt = schema?.options?.find(
        (o) => o.name === "--bottlenecks-top",
      );
      expect(topOpt).toBeDefined();
      expect(topOpt?.type).toBe("number");

      const thresholdOpt = schema?.options?.find(
        (o) => o.name === "--bottlenecks-threshold",
      );
      expect(thresholdOpt).toBeDefined();
      expect(thresholdOpt?.type).toBe("number");
    });
  });

  describe("Program construction", () => {
    it("creates a root program with the expected task families", () => {
      const program = createProgram();
      const subcommandNames = program.commands.map((command) => command.name());
      expect(subcommandNames).toEqual([
        "inspect",
        "find",
        "trace",
        "export",
        "check",
        "describe",
      ]);
    });

    it("creates nested inspect subcommands", () => {
      const program = createProgram();
      const inspect = program.commands.find(
        (command) => command.name() === "inspect",
      );
      expect(inspect).toBeInstanceOf(Command);
      expect(inspect?.commands.map((command) => command.name())).toEqual([
        "summary",
        "run",
        "timeline",
        "inventory",
      ]);
    });

    it("fails legacy commands with a targeted migration message", () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
        code?: string | number | null,
      ) => {
        throw new Error(`exit:${code}`);
      }) as typeof process.exit);
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      expect(() => run(["node", "dbt-tools", "deps"])).toThrow("exit:1");
      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy.mock.calls[0]?.[0]).toContain("trace lineage");

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe("Input validation patterns", () => {
    it("should validate resource IDs correctly", () => {
      expect(() =>
        validateResourceId("model.my_project.customers"),
      ).not.toThrow();
      expect(() => validateResourceId("model.x?fields=name")).toThrow();
      expect(() => validateResourceId("model%2ex")).toThrow();
    });

    it("should validate paths correctly", () => {
      expect(() => validateSafePath("./target/manifest.json")).not.toThrow();
      expect(() => validateSafePath("../../.ssh")).toThrow();
    });

    it("should reject invalid depth (NaN / non-integer) for lineage", () => {
      expect(() => validateDepth(undefined)).not.toThrow();
      expect(() => validateDepth(1)).not.toThrow();
      expect(() => validateDepth(Number.NaN)).toThrow("Invalid depth");
      expect(() => validateDepth("abc" as unknown as number)).toThrow(
        "Invalid depth",
      );
    });
  });

  describe("Output formatting", () => {
    it("should format lineage output correctly", () => {
      const result = {
        resource_id: "model.test.example",
        direction: "downstream" as const,
        dependencies: [
          {
            unique_id: "model.test.dep",
            resource_type: "model",
            name: "dep",
            package_name: "test",
            depth: 1,
          },
        ],
        count: 1,
      };

      const output = formatDeps(result);
      expect(output).toContain("Dependencies for model.test.example");
      expect(output).toContain("downstream");
      expect(output).toContain("model.test.dep");
    });

    it("should format summary output correctly", () => {
      const summary = {
        total_nodes: 10,
        total_edges: 15,
        has_cycles: false,
        nodes_by_type: { model: 8, test: 2 },
      };

      const output = formatSummary(summary);
      expect(output).toContain("dbt Project Summary");
      expect(output).toContain("Total Nodes: 10");
    });
  });
});
