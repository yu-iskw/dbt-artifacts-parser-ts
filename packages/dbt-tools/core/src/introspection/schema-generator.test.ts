import { describe, it, expect } from "vitest";
import { SchemaGenerator } from "./schema-generator";

describe("SchemaGenerator", () => {
  describe("getCommandSchema", () => {
    it("should return schema for analyze command", () => {
      const schema = SchemaGenerator.getCommandSchema("analyze");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("analyze");
      expect(schema?.arguments).toBeInstanceOf(Array);
      expect(schema?.options).toBeInstanceOf(Array);
    });

    it("should return schema for deps command", () => {
      const schema = SchemaGenerator.getCommandSchema("deps");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("deps");
      expect(schema?.arguments).toBeInstanceOf(Array);
      expect(schema?.options).toBeInstanceOf(Array);
      expect(schema?.arguments[0]?.name).toBe("resource-id");
      expect(schema?.arguments[0]?.required).toBe(true);
    });

    it("should return schema for graph command", () => {
      const schema = SchemaGenerator.getCommandSchema("graph");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("graph");
    });

    it("should return schema for run-report command", () => {
      const schema = SchemaGenerator.getCommandSchema("run-report");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("run-report");
    });

    it("should return schema for schema command", () => {
      const schema = SchemaGenerator.getCommandSchema("schema");
      expect(schema).not.toBeNull();
      expect(schema?.command).toBe("schema");
    });

    it("should return null for invalid command", () => {
      const schema = SchemaGenerator.getCommandSchema("invalid-command");
      expect(schema).toBeNull();
    });
  });

  describe("getAllSchemas", () => {
    it("should return all command schemas", () => {
      const schemas = SchemaGenerator.getAllSchemas();
      expect(schemas).toHaveProperty("analyze");
      expect(schemas).toHaveProperty("deps");
      expect(schemas).toHaveProperty("graph");
      expect(schemas).toHaveProperty("run-report");
      expect(schemas).toHaveProperty("schema");
    });

    it("should have complete schema structure for all commands", () => {
      const schemas = SchemaGenerator.getAllSchemas();
      for (const [command, schema] of Object.entries(schemas)) {
        expect(schema.command).toBe(command);
        expect(schema.description).toBeTruthy();
        expect(schema.arguments).toBeInstanceOf(Array);
        expect(schema.options).toBeInstanceOf(Array);
        expect(schema.output_format).toBeTruthy();
        expect(schema.example).toBeTruthy();
      }
    });

    it("should have correct argument structure", () => {
      const schemas = SchemaGenerator.getAllSchemas();
      for (const schema of Object.values(schemas)) {
        for (const arg of schema.arguments) {
          expect(arg).toHaveProperty("name");
          expect(arg).toHaveProperty("required");
          expect(arg).toHaveProperty("description");
          expect(typeof arg.name).toBe("string");
          expect(typeof arg.required).toBe("boolean");
          expect(typeof arg.description).toBe("string");
        }
      }
    });

    it("should have correct option structure", () => {
      const schemas = SchemaGenerator.getAllSchemas();
      for (const schema of Object.values(schemas)) {
        for (const option of schema.options) {
          expect(option).toHaveProperty("name");
          expect(option).toHaveProperty("type");
          expect(option).toHaveProperty("description");
          expect(typeof option.name).toBe("string");
          expect(typeof option.type).toBe("string");
          expect(typeof option.description).toBe("string");
        }
      }
    });

    it("should have enum values for enum type options", () => {
      const depsSchema = SchemaGenerator.getCommandSchema("deps");
      const directionOption = depsSchema?.options.find(
        (opt) => opt.name === "--direction",
      );
      expect(directionOption?.type).toBe("enum");
      expect(directionOption?.values).toEqual(["upstream", "downstream"]);
    });

    it("should have --format option for deps with flat and tree values", () => {
      const depsSchema = SchemaGenerator.getCommandSchema("deps");
      const formatOption = depsSchema?.options.find(
        (opt) => opt.name === "--format",
      );
      expect(formatOption).toBeDefined();
      expect(formatOption?.type).toBe("enum");
      expect(formatOption?.values).toEqual(["flat", "tree"]);
      expect(formatOption?.default).toBe("tree");
    });
  });
});
