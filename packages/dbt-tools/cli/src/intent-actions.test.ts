import * as fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJaffleArtifactBundleDir } from "./cli-test-bundle-dir";
import { discoverAction } from "./discover-action";
import { explainAction } from "./explain-action";
import { impactAction } from "./impact-action";

describe("intent-oriented actions", () => {
  const handleError = (error: unknown) => {
    throw error;
  };

  let dbtTargetDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dbtTargetDir = await createJaffleArtifactBundleDir();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();
    await fs.rm(dbtTargetDir, { recursive: true, force: true });
  });

  it("discover returns explainable ranked matches", async () => {
    await discoverAction(
      "orders",
      { dbtTarget: dbtTargetDir, json: true, limit: 3 },
      handleError,
    );

    const payload = JSON.parse(String(consoleLogSpy.mock.calls[0]?.[0])) as {
      intent: string;
      matches: Array<{ reasons: string[]; next_actions: string[] }>;
      review_url: string;
    };
    expect(payload.intent).toBe("discover");
    expect(payload.matches.length).toBeGreaterThan(0);
    expect(payload.matches[0]?.reasons.length).toBeGreaterThan(0);
    expect(payload.matches[0]?.next_actions).toContain("explain");
    expect(payload.review_url).toContain("http");
  });

  it("explain resolves ambiguous input and includes provenance", async () => {
    await explainAction(
      "orders",
      { dbtTarget: dbtTargetDir, json: true },
      handleError,
    );

    const payload = JSON.parse(String(consoleLogSpy.mock.calls[0]?.[0])) as {
      intent: string;
      target: { resolved_unique_id: string };
      provenance: { steps: Array<{ op: string; status: string }> };
    };
    expect(payload.intent).toBe("explain");
    expect(payload.target.resolved_unique_id).toContain("orders");
    expect(payload.provenance.steps.map((step) => step.op)).toContain(
      "discover.resolve",
    );
  });

  it("impact returns upstream/downstream counts", async () => {
    await impactAction(
      "orders",
      { dbtTarget: dbtTargetDir, json: true },
      handleError,
    );

    const payload = JSON.parse(String(consoleLogSpy.mock.calls[0]?.[0])) as {
      intent: string;
      impact: { upstream_count: number; downstream_count: number };
      review_url: string;
    };
    expect(payload.intent).toBe("impact");
    expect(payload.impact.upstream_count).toBeGreaterThanOrEqual(0);
    expect(payload.impact.downstream_count).toBeGreaterThanOrEqual(0);
    expect(payload.review_url).toContain("assetTab=lineage");
  });
});

