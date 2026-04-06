import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { getTestResourcePath } from "dbt-artifacts-parser/test-utils";
import { inventoryAction, formatInventory } from "./inventory-action";

describe("inventoryAction", () => {
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

  it("outputs JSON inventory of all resources", () => {
    inventoryAction(manifestPath, { json: true }, handleError, isTTY);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as { total: number; entries: unknown[] };
    expect(parsed).toHaveProperty("total");
    expect(parsed).toHaveProperty("entries");
    expect(Array.isArray(parsed.entries)).toBe(true);
    expect(parsed.total).toBeGreaterThan(0);
    expect(parsed.entries.length).toBe(parsed.total);
  });

  it("filters by resource type", () => {
    inventoryAction(
      manifestPath,
      { type: "model", json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      entries: Array<{ resource_type: string }>;
    };
    expect(
      parsed.entries.every((e) => e.resource_type === "model"),
    ).toBe(true);
    expect(parsed.entries.length).toBeGreaterThan(0);
  });

  it("filters by multiple types comma-separated", () => {
    inventoryAction(
      manifestPath,
      { type: "model,source", json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      entries: Array<{ resource_type: string }>;
    };
    const types = new Set(parsed.entries.map((e) => e.resource_type));
    expect(types.has("field")).toBe(false);
    expect(
      parsed.entries.every((e) => ["model", "source"].includes(e.resource_type)),
    ).toBe(true);
  });

  it("filters by package name", () => {
    inventoryAction(
      manifestPath,
      { package: "jaffle_shop", json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      entries: Array<{ package_name: string }>;
    };
    expect(parsed.entries.length).toBeGreaterThan(0);
    expect(
      parsed.entries.every((e) => e.package_name === "jaffle_shop"),
    ).toBe(true);
  });

  it("filters by tag (no match returns empty)", () => {
    inventoryAction(
      manifestPath,
      { tag: "nonexistent_tag_xyz", json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as { total: number };
    expect(parsed.total).toBe(0);
  });

  it("supports --fields to project output fields", () => {
    inventoryAction(
      manifestPath,
      { type: "model", fields: "entries", json: true },
      handleError,
      isTTY,
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as Record<string, unknown>;
    // When filtering to just "entries", the result should only have that key
    expect(parsed).toHaveProperty("entries");
    expect(parsed).not.toHaveProperty("total");
  });

  it("outputs human-readable format when noJson is set", () => {
    inventoryAction(
      manifestPath,
      { noJson: true },
      handleError,
      () => true,
    );

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain("dbt Inventory");
    expect(output).toContain("Total resources:");
  });

  it("throws when manifest is not found", () => {
    expect(() =>
      inventoryAction(
        "/nonexistent/path/manifest.json",
        { json: true },
        handleError,
        isTTY,
      ),
    ).toThrow(/not found/);
  });
});

describe("formatInventory", () => {
  it("formats empty result gracefully", () => {
    const result = { total: 0, entries: [] };
    const output = formatInventory(result);
    expect(output).toContain("dbt Inventory");
    expect(output).toContain("Total resources: 0");
    expect(output).toContain("(no matching resources)");
  });

  it("groups entries by type", () => {
    const result = {
      total: 2,
      entries: [
        {
          unique_id: "model.p.a",
          resource_type: "model",
          name: "a",
          package_name: "p",
        },
        {
          unique_id: "source.p.b",
          resource_type: "source",
          name: "b",
          package_name: "p",
        },
      ],
    };
    const output = formatInventory(result);
    expect(output).toContain("model (1)");
    expect(output).toContain("source (1)");
    expect(output).toContain("model.p.a");
    expect(output).toContain("source.p.b");
  });

  it("shows tags when present", () => {
    const result = {
      total: 1,
      entries: [
        {
          unique_id: "model.p.a",
          resource_type: "model",
          name: "a",
          package_name: "p",
          tags: ["finance", "core"],
        },
      ],
    };
    const output = formatInventory(result);
    expect(output).toContain("[finance, core]");
  });
});
