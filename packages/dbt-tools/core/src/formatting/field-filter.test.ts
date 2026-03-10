import { describe, it, expect } from "vitest";
import { FieldFilter } from "./field-filter";

describe("FieldFilter", () => {
  describe("filterFields", () => {
    it("should return original data when no fields specified", () => {
      const data = { a: 1, b: 2, c: 3 };
      const result = FieldFilter.filterFields(data);
      expect(result).toEqual(data);
    });

    it("should return original data when fields is empty", () => {
      const data = { a: 1, b: 2, c: 3 };
      const result = FieldFilter.filterFields(data, "");
      expect(result).toEqual(data);
    });

    it("should filter simple fields", () => {
      const data = { a: 1, b: 2, c: 3 };
      const result = FieldFilter.filterFields(data, "a,b");
      expect(result).toEqual({ a: 1, b: 2 });
    });

    it("should filter single field", () => {
      const data = { a: 1, b: 2, c: 3 };
      const result = FieldFilter.filterFields(data, "a");
      expect(result).toEqual({ a: 1 });
    });

    it("should handle nested fields", () => {
      const data = {
        unique_id: "model.x",
        attributes: {
          resource_type: "model",
          name: "x",
        },
      };
      const result = FieldFilter.filterFields(
        data,
        "unique_id,attributes.resource_type",
      );
      expect(result).toEqual({
        unique_id: "model.x",
        attributes: {
          resource_type: "model",
        },
      });
    });

    it("should handle non-existent fields gracefully", () => {
      const data = { a: 1, b: 2 };
      const result = FieldFilter.filterFields(data, "a,non_existent");
      expect(result).toEqual({ a: 1 });
    });

    it("should handle non-object data", () => {
      expect(FieldFilter.filterFields("string", "field")).toBe("string");
      expect(FieldFilter.filterFields(123, "field")).toBe(123);
      expect(FieldFilter.filterFields(null, "field")).toBe(null);
    });

    it("should trim whitespace in field list", () => {
      const data = { a: 1, b: 2, c: 3 };
      const result = FieldFilter.filterFields(data, " a , b ");
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe("filterArrayFields", () => {
    it("should return original array when no fields specified", () => {
      const data = [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ];
      const result = FieldFilter.filterArrayFields(data);
      expect(result).toEqual(data);
    });

    it("should filter fields in each array element", () => {
      const data = [
        { a: 1, b: 2, c: 3 },
        { a: 4, b: 5, c: 6 },
      ];
      const result = FieldFilter.filterArrayFields(data, "a,b");
      expect(result).toEqual([
        { a: 1, b: 2 },
        { a: 4, b: 5 },
      ]);
    });

    it("should handle nested fields in arrays", () => {
      const data = [
        {
          unique_id: "model.x",
          attributes: { resource_type: "model", name: "x" },
        },
        {
          unique_id: "model.y",
          attributes: { resource_type: "model", name: "y" },
        },
      ];
      const result = FieldFilter.filterArrayFields(
        data,
        "unique_id,attributes.name",
      );
      expect(result).toEqual([
        { unique_id: "model.x", attributes: { name: "x" } },
        { unique_id: "model.y", attributes: { name: "y" } },
      ]);
    });

    it("should handle non-array data", () => {
      const data = { a: 1 };
      const result = FieldFilter.filterArrayFields(data, "a");
      expect(result).toEqual(data);
    });

    it("should handle empty array", () => {
      const result = FieldFilter.filterArrayFields([], "a");
      expect(result).toEqual([]);
    });
  });
});
