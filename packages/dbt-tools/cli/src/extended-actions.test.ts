import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, copyFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getTestResourcePath } from "dbt-artifacts-parser/test-utils";
import {
  inventoryAction,
  timelineAction,
  searchAction,
  statusAction,
  graphAction,
} from "./extended-actions";

describe("extended CLI actions", () => {
  const manifestPath = getTestResourcePath(
    "manifest",
    "v12",
    "resources",
    "jaffle_shop",
    "manifest_1.10.json",
  );
  const runResultsPath = getTestResourcePath(
    "run_results",
    "v6",
    "resources",
    "jaffle_shop",
    "run_results.json",
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

  it("inventory outputs filtered JSON rows", () => {
    inventoryAction(
      {
        manifestPath,
        runResultsPath,
        type: "model",
        fields: "unique_id,name,resource_type",
        json: true,
      },
      { handleError, isTTY },
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      count: number;
      resources: Array<{ unique_id: string; resource_type: string }>;
    };
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.resources.every((row) => row.resource_type === "model")).toBe(
      true,
    );
  });

  it("timeline supports failed-only and JSON shape", () => {
    timelineAction(
      {
        manifestPath,
        runResultsPath,
        failedOnly: true,
        json: true,
      },
      { handleError, isTTY },
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      timeline: Array<{ status: string; unique_id: string }>;
    };
    expect(Array.isArray(parsed.timeline)).toBe(true);
    expect(parsed.timeline.every((row) => row.unique_id.includes("."))).toBe(true);
  });

  it("timeline supports csv output", () => {
    timelineAction(
      {
        runResultsPath,
        format: "csv",
        noJson: true,
      },
      { handleError, isTTY: () => true },
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain("unique_id,name,resource_type,status");
  });

  it("search supports scoped term and free text ranking", () => {
    searchAction(
      ["type:model", "orders"],
      {
        manifestPath,
        json: true,
      },
      { handleError, isTTY },
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      count: number;
      results: Array<{ unique_id: string; resource_type: string }>;
    };
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.results[0]?.resource_type).toBe("model");
  });

  it("status reports manifest-ready when run_results missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "dbt-tools-status-"));
    try {
      copyFileSync(manifestPath, join(dir, "manifest.json"));
      statusAction(
        {
          targetDir: dir,
          json: true,
        },
        { handleError, isTTY },
      );

      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output) as {
        readiness: { state: string; execution_ready: boolean };
      };
      expect(parsed.readiness.state).toBe("manifest-ready");
      expect(parsed.readiness.execution_ready).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("graph supports focused subgraph export", () => {
    graphAction(
      manifestPath,
      {
        format: "json",
        focus: "model.jaffle_shop.orders",
        direction: "upstream",
        depth: 1,
      },
      { handleError, isTTY },
    );

    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output) as {
      nodes: Array<{ id: string }>;
      edges: Array<{ source: string; target: string }>;
    };
    expect(parsed.nodes.length).toBeGreaterThan(0);
    expect(
      parsed.nodes.some((node) => node.id === "model.jaffle_shop.orders"),
    ).toBe(true);
    expect(parsed.edges.length).toBeGreaterThanOrEqual(0);
  });

  it("graph focus throws for unknown selector", () => {
    expect(() =>
      graphAction(
        manifestPath,
        {
          format: "json",
          focus: "tag:definitely_missing",
        },
        { handleError, isTTY },
      ),
    ).toThrow(/No nodes matched --focus selector/);
  });
});
