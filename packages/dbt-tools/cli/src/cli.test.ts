import { describe, it, expect } from "vitest";
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
    it("should have schema for all commands", () => {
      const schemas = getAllSchemas();
      expect(schemas).toHaveProperty("summary");
      expect(schemas).toHaveProperty("deps");
      expect(schemas).toHaveProperty("graph");
      expect(schemas).toHaveProperty("run-report");
      expect(schemas).toHaveProperty("schema");
    });

    it("should have correct deps command schema", () => {
      const schema = getCommandSchema("deps");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("deps");
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

    it("should have correct graph command schema with field-level", () => {
      const schema = getCommandSchema("graph");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("graph");

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

    it("should have run-report schema with bottleneck options", () => {
      const schema = getCommandSchema("run-report");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("run-report");

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

    it("should reject invalid depth (NaN / non-integer) for deps", () => {
      expect(() => validateDepth(undefined)).not.toThrow();
      expect(() => validateDepth(1)).not.toThrow();
      expect(() => validateDepth(Number.NaN)).toThrow("Invalid depth");
      expect(() => validateDepth("abc" as unknown as number)).toThrow(
        "Invalid depth",
      );
    });
  });

  describe("Output formatting", () => {
    it("should format deps output correctly", () => {
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
