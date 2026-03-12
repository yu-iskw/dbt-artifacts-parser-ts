import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isTTY,
  shouldOutputJSON,
  formatOutput,
  formatAnalyze,
  formatDeps,
  formatRunReport,
  formatHumanReadable,
} from "./output-formatter";

describe("OutputFormatter", () => {
  const originalIsTTY = process.stdout.isTTY;

  beforeEach(() => {
    // Reset to original state
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
  });

  describe("isTTY", () => {
    it("should detect TTY when stdout is TTY", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });
      expect(isTTY()).toBe(true);
    });

    it("should detect non-TTY when stdout is not TTY", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        writable: true,
        configurable: true,
      });
      expect(isTTY()).toBe(false);
    });
  });

  describe("shouldOutputJSON", () => {
    it("should return false for TTY when no flags", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });
      expect(shouldOutputJSON()).toBe(false);
    });

    it("should return true for non-TTY when no flags", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        writable: true,
        configurable: true,
      });
      expect(shouldOutputJSON()).toBe(true);
    });

    it("should respect --json flag", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });
      expect(shouldOutputJSON(true)).toBe(true);
    });

    it("should respect --no-json flag", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        writable: true,
        configurable: true,
      });
      expect(shouldOutputJSON(undefined, true)).toBe(false);
    });

    it("should prioritize --no-json over --json", () => {
      expect(shouldOutputJSON(true, true)).toBe(false);
    });
  });

  describe("formatOutput", () => {
    it("should format as JSON when shouldOutputJSON is true", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        writable: true,
        configurable: true,
      });
      const data = { test: "value" };
      const output = formatOutput(data);
      expect(output).toBe(JSON.stringify(data, null, 2));
    });

    it("should format as string when shouldOutputJSON is false", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });
      const data = { test: "value" };
      const output = formatOutput(data);
      expect(typeof output).toBe("string");
    });

    it("should respect forceJson flag", () => {
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        writable: true,
        configurable: true,
      });
      const data = { test: "value" };
      const output = formatOutput(data, true);
      expect(output).toBe(JSON.stringify(data, null, 2));
    });
  });

  describe("formatAnalyze", () => {
    it("should format analyze output correctly", () => {
      const summary = {
        total_nodes: 10,
        total_edges: 15,
        has_cycles: false,
        nodes_by_type: { model: 8, test: 2 },
      };
      const output = formatAnalyze(summary);
      expect(output).toContain("dbt Project Analysis");
      expect(output).toContain("Total Nodes: 10");
      expect(output).toContain("Total Edges: 15");
      expect(output).toContain("Has Cycles: No");
      expect(output).toContain("model: 8");
      expect(output).toContain("test: 2");
    });
  });

  describe("formatDeps", () => {
    it("should format deps output correctly", () => {
      const result = {
        resource_id: "model.my_project.customers",
        direction: "downstream" as const,
        dependencies: [
          {
            unique_id: "model.my_project.orders",
            resource_type: "model",
            name: "orders",
            package_name: "my_project",
          },
        ],
        count: 1,
      };
      const output = formatDeps(result);
      expect(output).toContain("Dependencies for model.my_project.customers");
      expect(output).toContain("Direction: downstream");
      expect(output).toContain("Count: 1");
      expect(output).toContain("model.my_project.orders");
    });

    it("should handle empty dependencies", () => {
      const result = {
        resource_id: "model.my_project.customers",
        direction: "downstream" as const,
        dependencies: [],
        count: 0,
      };
      const output = formatDeps(result);
      expect(output).toContain("(none)");
    });

    it("should format tree output when format is tree", () => {
      const result = {
        resource_id: "model.jaffle_shop.stg_customers",
        direction: "downstream" as const,
        dependencies: [
          {
            unique_id: "model.jaffle_shop.customers",
            resource_type: "model",
            name: "customers",
            depth: 1,
            dependencies: [
              {
                unique_id: "test.jaffle_shop.not_null_customers",
                resource_type: "test",
                name: "not_null_customers",
                depth: 2,
                dependencies: [],
              },
            ],
          },
        ],
        count: 2,
      };
      const output = formatDeps(result, "tree");
      expect(output).toContain("stg_customers");
      expect(output).toContain("downstream");
      expect(output).toContain("model.jaffle_shop.customers");
      expect(output).toContain("test.jaffle_shop.not_null_customers");
      expect(output).toContain("[depth 1]");
      expect(output).toContain("[depth 2]");
      expect(output).toMatch(/├──|└──/);
    });

    it("should format empty tree when format is tree and no dependencies", () => {
      const result = {
        resource_id: "model.test.leaf",
        direction: "downstream" as const,
        dependencies: [],
        count: 0,
      };
      const output = formatDeps(result, "tree");
      expect(output).toContain("leaf");
      expect(output).toContain("downstream");
      expect(output).toContain("Count: 0");
      expect(output).not.toMatch(/├──|└──/);
    });

    it("should format tree with single root-level node (no children)", () => {
      const result = {
        resource_id: "model.test.root",
        direction: "downstream" as const,
        dependencies: [
          {
            unique_id: "model.test.only_child",
            resource_type: "model",
            name: "only_child",
            depth: 1,
            dependencies: [],
          },
        ],
        count: 1,
      };
      const output = formatDeps(result, "tree");
      expect(output).toContain("root");
      expect(output).toContain("model.test.only_child");
      expect(output).toContain("[depth 1]");
      expect(output).toMatch(/└──/);
    });
  });

  describe("formatRunReport", () => {
    it("should format run report output correctly", () => {
      const summary = {
        total_execution_time: 123.45,
        total_nodes: 10,
        nodes_by_status: { success: 8, error: 2 },
      };
      const output = formatRunReport(summary);
      expect(output).toContain("dbt Execution Report");
      expect(output).toContain("Total Execution Time: 123.45s");
      expect(output).toContain("Total Nodes: 10");
      expect(output).toContain("success: 8");
      expect(output).toContain("error: 2");
    });

    it("should include critical path when present", () => {
      const summary = {
        total_execution_time: 123.45,
        total_nodes: 10,
        nodes_by_status: { success: 10 },
        critical_path: {
          path: ["model.a", "model.b", "model.c"],
          total_time: 50.0,
        },
      };
      const output = formatRunReport(summary);
      expect(output).toContain("Critical Path:");
      expect(output).toContain("model.a -> model.b -> model.c");
      expect(output).toContain("Total Time: 50.00s");
    });
  });

  describe("formatHumanReadable", () => {
    it("should format analyze output", () => {
      const data = {
        total_nodes: 10,
        total_edges: 15,
        has_cycles: false,
        nodes_by_type: { model: 8 },
      };
      const output = formatHumanReadable(data, "analyze");
      expect(output).toContain("dbt Project Analysis");
    });

    it("should format deps output", () => {
      const data = {
        resource_id: "model.x",
        direction: "downstream" as const,
        dependencies: [],
        count: 0,
      };
      const output = formatHumanReadable(data, "deps");
      expect(output).toContain("Dependencies for model.x");
    });

    it("should format run-report output", () => {
      const data = {
        total_execution_time: 10,
        total_nodes: 5,
        nodes_by_status: {},
      };
      const output = formatHumanReadable(data, "run-report");
      expect(output).toContain("dbt Execution Report");
    });
  });
});
