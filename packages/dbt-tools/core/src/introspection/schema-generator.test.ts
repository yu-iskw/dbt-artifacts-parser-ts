import { describe, it, expect } from "vitest";
import { getCommandSchema, getAllSchemas } from "./schema-generator";

describe("SchemaGenerator", () => {
  describe("getCommandSchema", () => {
    it("returns the root schema tree", () => {
      const schema = getAllSchemas();
      expect(schema.kind).toBe("root");
      expect(schema.path).toEqual([]);
      expect(schema.subcommands).toHaveProperty("inspect");
      expect(schema.subcommands).toHaveProperty("find");
      expect(schema.subcommands).toHaveProperty("trace");
      expect(schema.subcommands).toHaveProperty("export");
      expect(schema.subcommands).toHaveProperty("check");
      expect(schema.subcommands).toHaveProperty("describe");
    });

    it("returns schema for a command group path", () => {
      const schema = getCommandSchema("inspect");
      expect(schema).not.toBeNull();
      expect(schema?.kind).toBe("group");
      expect(schema?.command).toBe("inspect");
      expect(schema?.subcommands).toHaveProperty("summary");
      expect(schema?.subcommands).toHaveProperty("run");
    });

    it("returns schema for a leaf command path", () => {
      const schema = getCommandSchema("trace lineage");
      expect(schema).not.toBeNull();
      expect(schema?.kind).toBe("command");
      expect(schema?.command).toBe("trace lineage");
      expect(schema?.arguments[0]?.name).toBe("resource-id");
      expect(schema?.arguments[0]?.required).toBe(true);
    });

    it("accepts array-based command path segments", () => {
      const schema = getCommandSchema(["describe", "schema"]);
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("describe schema");
      expect(schema?.path).toEqual(["describe", "schema"]);
    });

    it("returns null for an invalid command path", () => {
      const schema = getCommandSchema("inspect invalid-command");
      expect(schema).toBeNull();
    });
  });

  describe("schema structure", () => {
    it("has complete schema structure for every node in the tree", () => {
      const visit = (schema = getAllSchemas()): void => {
        expect(schema.command).toBeTypeOf("string");
        expect(schema.description).toBeTruthy();
        expect(schema.path).toBeInstanceOf(Array);
        expect(schema.arguments).toBeInstanceOf(Array);
        expect(schema.options).toBeInstanceOf(Array);
        expect(schema.output_format).toBeTruthy();
        expect(schema.example).toBeTruthy();

        for (const arg of schema.arguments) {
          expect(arg).toHaveProperty("name");
          expect(arg).toHaveProperty("required");
          expect(arg).toHaveProperty("description");
          expect(typeof arg.name).toBe("string");
          expect(typeof arg.required).toBe("boolean");
          expect(typeof arg.description).toBe("string");
        }

        for (const option of schema.options) {
          expect(option).toHaveProperty("name");
          expect(option).toHaveProperty("type");
          expect(option).toHaveProperty("description");
          expect(typeof option.name).toBe("string");
          expect(typeof option.type).toBe("string");
          expect(typeof option.description).toBe("string");
        }

        for (const child of Object.values(schema.subcommands ?? {})) {
          visit(child);
        }
      };

      visit();
    });

    it("has enum values for trace lineage direction", () => {
      const schema = getCommandSchema("trace lineage");
      const directionOption = schema?.options.find(
        (opt) => opt.name === "--direction",
      );
      expect(directionOption?.type).toBe("enum");
      expect(directionOption?.values).toEqual(["upstream", "downstream"]);
    });

    it("has flat and tree format values for trace lineage", () => {
      const schema = getCommandSchema("trace lineage");
      const formatOption = schema?.options.find(
        (opt) => opt.name === "--format",
      );
      expect(formatOption).toBeDefined();
      expect(formatOption?.type).toBe("enum");
      expect(formatOption?.values).toEqual(["flat", "tree"]);
      expect(formatOption?.default).toBe("tree");
    });

    it("includes future-friendly grouped command families at the root", () => {
      const root = getAllSchemas();
      expect(Object.keys(root.subcommands ?? {})).toEqual([
        "inspect",
        "find",
        "trace",
        "export",
        "check",
        "describe",
      ]);
    });
  });
});
