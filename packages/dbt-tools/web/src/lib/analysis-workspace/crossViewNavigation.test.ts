import { describe, expect, it } from "vitest";
import { buildCrossViewNavigationTargets } from "./crossViewNavigation";

describe("buildCrossViewNavigationTargets", () => {
  it("builds all pivots when both resource and execution ids exist", () => {
    const targets = buildCrossViewNavigationTargets({
      resourceId: "model.pkg.orders",
      executionId: "model.pkg.orders",
    });
    expect(targets.inventory?.view).toBe("inventory");
    expect(targets.inventory?.options?.assetTab).toBe("summary");
    expect(targets.lineage?.options?.assetTab).toBe("lineage");
    expect(targets.timeline?.view).toBe("timeline");
    expect(targets.runs?.view).toBe("runs");
    expect(targets.health.view).toBe("health");
  });

  it("omits unavailable pivots when ids are missing", () => {
    const targets = buildCrossViewNavigationTargets({});
    expect(targets.inventory).toBeNull();
    expect(targets.lineage).toBeNull();
    expect(targets.runs).toBeNull();
    expect(targets.timeline).toBeNull();
    expect(targets.health.view).toBe("health");
  });
});
