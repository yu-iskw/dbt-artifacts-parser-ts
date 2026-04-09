import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  resolvePrCaptureTargets,
  type CaptureRulesFile,
} from "./resolve-pr-capture-targets";

const dir = path.dirname(fileURLToPath(import.meta.url));
const rules = JSON.parse(
  fs.readFileSync(path.join(dir, "../capture-rules.json"), "utf8"),
) as CaptureRulesFile;

describe("resolvePrCaptureTargets", () => {
  it("maps health view files to health only", () => {
    const m = resolvePrCaptureTargets(
      [
        "packages/dbt-tools/web/src/components/AnalysisWorkspace/views/health/HealthView.tsx",
      ],
      rules,
    );
    expect(m.targets.map((t) => t.id)).toEqual(["health"]);
  });

  it("unions multiple rules and sorts ids", () => {
    const m = resolvePrCaptureTargets(
      [
        "packages/dbt-tools/web/src/components/AnalysisWorkspace/timeline/TimelineView.tsx",
        "packages/dbt-tools/web/src/components/AnalysisWorkspace/views/runs/RunsView.tsx",
      ],
      rules,
    );
    expect(m.targets.map((t) => t.id)).toEqual(["runs", "timeline"]);
  });

  it("maps AppShell changes to all primary views", () => {
    const m = resolvePrCaptureTargets(
      ["packages/dbt-tools/web/src/components/AppShell/appNavigation.ts"],
      rules,
    );
    expect(m.targets.map((t) => t.id)).toEqual([
      "health",
      "inventory",
      "runs",
      "timeline",
    ]);
  });

  it("returns empty targets when nothing matches", () => {
    const m = resolvePrCaptureTargets(["README.md"], rules);
    expect(m.targets).toEqual([]);
  });

  it("caps at 8 targets and sets truncated metadata", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      String(i).padStart(2, "0"),
    );
    const custom: CaptureRulesFile = {
      version: 1,
      rules: [{ globs: ["touch/**"], targets: many }],
    };
    const m = resolvePrCaptureTargets(["touch/x"], custom);
    expect(m.targets).toHaveLength(8);
    expect(m.truncated).toBe(true);
    expect(m.totalMatched).toBe(12);
  });
});
