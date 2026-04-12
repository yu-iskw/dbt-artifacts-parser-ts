import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// @ts-expect-error - workspace package, TypeScript resolves via package.json
import { getTestResourcePath } from "dbt-artifacts-parser/test-utils";
import { depsAction } from "./deps-action";

describe("depsAction", () => {
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

  it("outputs upstream deps for a model with tree format", async () => {
    await depsAction(
      "model.jaffle_shop.stg_products",
      {
        manifestPath,
        direction: "upstream",
        format: "tree",
      },
      handleError,
      isTTY,
    );

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join("\n");
    expect(output).toContain("model.jaffle_shop.stg_products");
    expect(output).toMatch(
      /source\.jaffle_shop\.ecom\.raw_products|stg_products/,
    );
  });

  it("outputs upstream deps with flat format", async () => {
    await depsAction(
      "model.jaffle_shop.stg_products",
      {
        manifestPath,
        direction: "upstream",
        format: "flat",
      },
      handleError,
      isTTY,
    );

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join("\n");
    expect(output).toContain("model.jaffle_shop.stg_products");
  });

  it("outputs downstream deps for a model", async () => {
    await depsAction(
      "model.jaffle_shop.stg_products",
      {
        manifestPath,
        direction: "downstream",
        format: "tree",
      },
      handleError,
      isTTY,
    );

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join("\n");
    expect(output).toContain("model.jaffle_shop.stg_products");
  });

  it("outputs JSON when json option is true", async () => {
    await depsAction(
      "model.jaffle_shop.stg_products",
      {
        manifestPath,
        direction: "upstream",
        format: "tree",
        json: true,
      },
      handleError,
      isTTY,
    );

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.flat().join("");
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty(
      "resource_id",
      "model.jaffle_shop.stg_products",
    );
  });

  it("respects depth option", async () => {
    await depsAction(
      "model.jaffle_shop.customers",
      {
        manifestPath,
        direction: "upstream",
        format: "tree",
        depth: 1,
      },
      handleError,
      isTTY,
    );

    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("throws for invalid direction", async () => {
    await expect(
      depsAction(
        "model.jaffle_shop.stg_products",
        {
          manifestPath,
          direction: "invalid",
          format: "tree",
        },
        handleError,
        isTTY,
      ),
    ).rejects.toThrow(/Invalid direction/);
  });

  it("throws for invalid resource id", async () => {
    await expect(
      depsAction(
        "",
        {
          manifestPath,
          direction: "upstream",
          format: "tree",
        },
        handleError,
        isTTY,
      ),
    ).rejects.toThrow();
  });
});
