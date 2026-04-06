import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { getTestResourcePath } from "dbt-artifacts-parser/test-utils";
import { searchAction, formatSearch } from "./search-action";

describe("searchAction", () => {
  const manifestPath = getTestResourcePath(
    "manifest",
    "v12",
    "resources",
    "jaffle_shop",
    "manifest_1.10.json",
  );

  const handleError = (error: unknown) => {
    throw error;
  };
  const isTTY = () => false;

  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("returns all resources when no query or filters", () => {
    searchAction(undefined, manifestPath, { json: true }, handleError, isTTY);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as { total: number; results: unknown[] };
    expect(parsed.total).toBeGreaterThan(0);
    expect(parsed.results.length).toBe(parsed.total);
  });

  it("returns structured result shape", () => {
    searchAction("orders", manifestPath, { json: true }, handleError, isTTY);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      query: string;
      total: number;
      results: Array<{
        unique_id: string;
        resource_type: string;
        name: string;
        package_name: string;
      }>;
    };
    expect(parsed).toHaveProperty("query", "orders");
    expect(parsed).toHaveProperty("total");
    expect(Array.isArray(parsed.results)).toBe(true);
    if (parsed.results.length > 0) {
      const r = parsed.results[0];
      expect(r).toHaveProperty("unique_id");
      expect(r).toHaveProperty("resource_type");
      expect(r).toHaveProperty("name");
      expect(r).toHaveProperty("package_name");
    }
  });

  it("returns results matching a name substring", () => {
    searchAction("customers", manifestPath, { json: true }, handleError, isTTY);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      results: Array<{ name: string; unique_id: string; path?: string; package_name: string }>;
    };
    expect(parsed.results.length).toBeGreaterThan(0);
    // All results should have 'customers' in one of the indexed fields
    expect(
      parsed.results.every(
        (r) =>
          r.name.toLowerCase().includes("customers") ||
          r.unique_id.toLowerCase().includes("customers") ||
          r.package_name.toLowerCase().includes("customers") ||
          (r.path ?? "").toLowerCase().includes("customers"),
      ),
    ).toBe(true);
  });

  it("supports inline type: filter in query", () => {
    searchAction("type:model", manifestPath, { json: true }, handleError, isTTY);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      results: Array<{ resource_type: string }>;
    };
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(
      parsed.results.every((r) => r.resource_type === "model"),
    ).toBe(true);
  });

  it("supports --type flag", () => {
    searchAction(
      undefined,
      manifestPath,
      { type: "source", json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      results: Array<{ resource_type: string }>;
    };
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(
      parsed.results.every((r) => r.resource_type === "source"),
    ).toBe(true);
  });

  it("supports --package flag", () => {
    searchAction(
      undefined,
      manifestPath,
      { package: "jaffle_shop", json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      results: Array<{ package_name: string }>;
    };
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(
      parsed.results.every((r) => r.package_name === "jaffle_shop"),
    ).toBe(true);
  });

  it("returns empty results for unmatched query", () => {
    searchAction(
      "zzz_no_such_model_xyz",
      manifestPath,
      { json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as { total: number };
    expect(parsed.total).toBe(0);
  });

  it("outputs human-readable format in TTY mode", () => {
    searchAction(
      "customers",
      manifestPath,
      { noJson: true },
      handleError,
      () => true,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain("Search results");
  });

  it("excludes field-type nodes", () => {
    searchAction(undefined, manifestPath, { json: true }, handleError, isTTY);

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      results: Array<{ resource_type: string }>;
    };
    expect(
      parsed.results.every((r) => r.resource_type !== "field"),
    ).toBe(true);
  });

  it("throws for control characters in query", () => {
    expect(() =>
      searchAction("\x00bad", manifestPath, {}, handleError, isTTY),
    ).toThrow();
  });

  it("throws when manifest is not found", () => {
    expect(() =>
      searchAction(
        "orders",
        "/nonexistent/manifest.json",
        {},
        handleError,
        isTTY,
      ),
    ).toThrow(/not found/);
  });
});

describe("formatSearch", () => {
  it("formats empty output gracefully", () => {
    const output = formatSearch({ total: 0, results: [] });
    expect(output).toContain("0 results found");
  });

  it("includes query in header when provided", () => {
    const output = formatSearch({
      query: "orders",
      total: 1,
      results: [
        {
          unique_id: "model.p.orders",
          resource_type: "model",
          name: "orders",
          package_name: "p",
        },
      ],
    });
    expect(output).toContain('Search results for "orders"');
    expect(output).toContain("model.p.orders");
  });
});
