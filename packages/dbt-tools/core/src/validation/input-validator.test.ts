import { describe, it, expect } from "vitest";
import { InputValidator } from "./input-validator";

describe("InputValidator", () => {
  describe("validateSafePath", () => {
    it("should accept valid paths", () => {
      expect(() =>
        InputValidator.validateSafePath("./target/manifest.json"),
      ).not.toThrow();
      expect(() =>
        InputValidator.validateSafePath("target/manifest.json"),
      ).not.toThrow();
      expect(() =>
        InputValidator.validateSafePath("/absolute/path.json"),
      ).not.toThrow();
    });

    it("should reject path traversals", () => {
      expect(() => InputValidator.validateSafePath("../../.ssh")).toThrow(
        "Path traversal detected",
      );
      expect(() => InputValidator.validateSafePath("../etc/passwd")).toThrow(
        "Path traversal detected",
      );
      expect(() => InputValidator.validateSafePath("..\\..\\etc")).toThrow(
        "Path traversal detected",
      );
      expect(() => InputValidator.validateSafePath("path/../other")).toThrow(
        "Path traversal detected",
      );
    });

    it("should reject empty or non-string paths", () => {
      expect(() => InputValidator.validateSafePath("")).toThrow(
        "Path must be a non-empty string",
      );
      expect(() =>
        InputValidator.validateSafePath(null as unknown as string),
      ).toThrow("Path must be a non-empty string");
      expect(() =>
        InputValidator.validateSafePath(undefined as unknown as string),
      ).toThrow("Path must be a non-empty string");
    });
  });

  describe("validateNoControlChars", () => {
    it("should accept normal strings", () => {
      expect(() =>
        InputValidator.validateNoControlChars("normal string"),
      ).not.toThrow();
      expect(() =>
        InputValidator.validateNoControlChars("model.my_project.customers"),
      ).not.toThrow();
    });

    it("should allow newline, carriage return, and tab", () => {
      expect(() =>
        InputValidator.validateNoControlChars("line1\nline2"),
      ).not.toThrow();
      expect(() =>
        InputValidator.validateNoControlChars("line1\rline2"),
      ).not.toThrow();
      expect(() =>
        InputValidator.validateNoControlChars("col1\tcol2"),
      ).not.toThrow();
    });

    it("should reject null bytes", () => {
      expect(() =>
        InputValidator.validateNoControlChars("test\u0000string"),
      ).toThrow("Control character detected");
    });

    it("should reject other control characters", () => {
      expect(() =>
        InputValidator.validateNoControlChars("test\u0001string"),
      ).toThrow("Control character detected");
      expect(() =>
        InputValidator.validateNoControlChars("test\u001fstring"),
      ).toThrow("Control character detected");
    });

    it("should handle empty strings", () => {
      expect(() => InputValidator.validateNoControlChars("")).not.toThrow();
      expect(() =>
        InputValidator.validateNoControlChars(null as unknown as string),
      ).not.toThrow();
    });
  });

  describe("validateResourceId", () => {
    it("should accept valid resource IDs", () => {
      expect(() =>
        InputValidator.validateResourceId("model.my_project.customers"),
      ).not.toThrow();
      expect(() =>
        InputValidator.validateResourceId("source.my_project.raw_data"),
      ).not.toThrow();
      expect(() =>
        InputValidator.validateResourceId("test.my_project.unique_customers"),
      ).not.toThrow();
    });

    it("should reject embedded query params", () => {
      expect(() =>
        InputValidator.validateResourceId("model.x?fields=name"),
      ).toThrow("Resource ID contains invalid characters");
      expect(() =>
        InputValidator.validateResourceId("model.x#fragment"),
      ).toThrow("Resource ID contains invalid characters");
    });

    it("should reject pre-encoded URLs", () => {
      expect(() => InputValidator.validateResourceId("model%2ex")).toThrow(
        "Resource ID appears to be URL-encoded",
      );
      expect(() => InputValidator.validateResourceId("model%2E%2Ex")).toThrow(
        "Resource ID appears to be URL-encoded",
      );
    });

    it("should reject empty or non-string IDs", () => {
      expect(() => InputValidator.validateResourceId("")).toThrow(
        "Resource ID must be a non-empty string",
      );
      expect(() =>
        InputValidator.validateResourceId(null as unknown as string),
      ).toThrow("Resource ID must be a non-empty string");
    });

    it("should also validate control characters", () => {
      expect(() => InputValidator.validateResourceId("model\u0000x")).toThrow(
        "Control character detected",
      );
    });
  });

  describe("validateNoPreEncoding", () => {
    it("should accept normal strings", () => {
      expect(() =>
        InputValidator.validateNoPreEncoding("normal string"),
      ).not.toThrow();
      expect(() =>
        InputValidator.validateNoPreEncoding("model.my_project.customers"),
      ).not.toThrow();
    });

    it("should reject encoded path traversals", () => {
      expect(() => InputValidator.validateNoPreEncoding("%2e%2e")).toThrow(
        "Pre-encoded path traversal detected",
      );
      expect(() => InputValidator.validateNoPreEncoding("%2E%2E")).toThrow(
        "Pre-encoded path traversal detected",
      );
      expect(() => InputValidator.validateNoPreEncoding("%2e%2e%2f")).toThrow(
        "Pre-encoded path traversal detected",
      );
      expect(() => InputValidator.validateNoPreEncoding("%2e%2e%5c")).toThrow(
        "Pre-encoded path traversal detected",
      );
    });

    it("should allow other percent-encoded strings that aren't traversal", () => {
      // This is a bit lenient - we only check for specific traversal patterns
      expect(() =>
        InputValidator.validateNoPreEncoding("test%20string"),
      ).not.toThrow();
    });

    it("should handle empty strings", () => {
      expect(() => InputValidator.validateNoPreEncoding("")).not.toThrow();
      expect(() =>
        InputValidator.validateNoPreEncoding(null as unknown as string),
      ).not.toThrow();
    });
  });

  describe("validateString", () => {
    it("should accept valid strings", () => {
      expect(() => InputValidator.validateString("valid string")).not.toThrow();
      expect(() =>
        InputValidator.validateString("model.my_project.customers"),
      ).not.toThrow();
    });

    it("should reject empty strings by default", () => {
      expect(() => InputValidator.validateString("")).toThrow(
        "Input must be a non-empty string",
      );
      expect(() => InputValidator.validateString("   ")).toThrow(
        "Input must be a non-empty string",
      );
    });

    it("should allow empty strings when flag is set", () => {
      expect(() => InputValidator.validateString("", true)).not.toThrow();
    });

    it("should validate control characters", () => {
      expect(() => InputValidator.validateString("test\u0000string")).toThrow(
        "Control character detected",
      );
    });

    it("should validate pre-encoding", () => {
      expect(() => InputValidator.validateString("%2e%2e")).toThrow(
        "Pre-encoded path traversal detected",
      );
    });
  });
});
