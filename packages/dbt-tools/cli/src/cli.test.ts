import { describe, it, expect } from "vitest";
import {
  InputValidator,
  OutputFormatter,
  SchemaGenerator,
} from "@dbt-tools/core";

describe("CLI Integration", () => {
  describe("Core service integration", () => {
    it("should have InputValidator available", () => {
      expect(InputValidator).toBeDefined();
      expect(typeof InputValidator.validateResourceId).toBe("function");
      expect(typeof InputValidator.validateSafePath).toBe("function");
    });

    it("should have OutputFormatter available", () => {
      expect(OutputFormatter).toBeDefined();
      expect(typeof OutputFormatter.isTTY).toBe("function");
      expect(typeof OutputFormatter.formatOutput).toBe("function");
    });

    it("should have SchemaGenerator available", () => {
      expect(SchemaGenerator).toBeDefined();
      expect(typeof SchemaGenerator.getCommandSchema).toBe("function");
      expect(typeof SchemaGenerator.getAllSchemas).toBe("function");
    });
  });

  describe("Command schema validation", () => {
    it("should have schema for all commands", () => {
      const schemas = SchemaGenerator.getAllSchemas();
      expect(schemas).toHaveProperty("analyze");
      expect(schemas).toHaveProperty("deps");
      expect(schemas).toHaveProperty("graph");
      expect(schemas).toHaveProperty("run-report");
      expect(schemas).toHaveProperty("schema");
    });

    it("should have correct deps command schema", () => {
      const schema = SchemaGenerator.getCommandSchema("deps");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("deps");
      expect(schema?.arguments.length).toBeGreaterThan(0);
      expect(schema?.arguments[0]?.name).toBe("resource-id");
      expect(schema?.arguments[0]?.required).toBe(true);
    });
  });

  describe("Input validation patterns", () => {
    it("should validate resource IDs correctly", () => {
      expect(() =>
        InputValidator.validateResourceId("model.my_project.customers"),
      ).not.toThrow();
      expect(() =>
        InputValidator.validateResourceId("model.x?fields=name"),
      ).toThrow();
      expect(() => InputValidator.validateResourceId("model%2ex")).toThrow();
    });

    it("should validate paths correctly", () => {
      expect(() =>
        InputValidator.validateSafePath("./target/manifest.json"),
      ).not.toThrow();
      expect(() => InputValidator.validateSafePath("../../.ssh")).toThrow();
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
          },
        ],
        count: 1,
      };

      const output = OutputFormatter.formatDeps(result);
      expect(output).toContain("Dependencies for model.test.example");
      expect(output).toContain("downstream");
      expect(output).toContain("model.test.dep");
    });

    it("should format analyze output correctly", () => {
      const summary = {
        total_nodes: 10,
        total_edges: 15,
        has_cycles: false,
        nodes_by_type: { model: 8, test: 2 },
      };

      const output = OutputFormatter.formatAnalyze(summary);
      expect(output).toContain("dbt Project Analysis");
      expect(output).toContain("Total Nodes: 10");
    });
  });
});
