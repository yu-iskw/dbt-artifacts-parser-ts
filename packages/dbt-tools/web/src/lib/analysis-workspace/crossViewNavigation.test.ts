import { describe, expect, it, vi } from "vitest";
import { buildCrossViewPivotActions } from "./crossViewNavigation";

describe("buildCrossViewPivotActions", () => {
  it("builds enabled actions when resource and execution are available", () => {
    const onNavigateTo = vi.fn();
    const actions = buildCrossViewPivotActions({
      context: {
        resourceId: "model.jaffle_shop.orders",
        executionId: "model.jaffle_shop.orders",
      },
      onNavigateTo,
    });

    expect(actions.map((action) => action.key)).toEqual([
      "inventory",
      "timeline",
      "runs",
      "health",
    ]);
    expect(actions.some((action) => action.disabled)).toBe(false);

    actions[0]?.onClick();
    actions[1]?.onClick();
    actions[2]?.onClick();
    actions[3]?.onClick();

    expect(onNavigateTo).toHaveBeenNthCalledWith(1, "inventory", {
      resourceId: "model.jaffle_shop.orders",
      assetTab: "summary",
      rootResourceId: "model.jaffle_shop.orders",
    });
    expect(onNavigateTo).toHaveBeenNthCalledWith(2, "timeline", {
      resourceId: "model.jaffle_shop.orders",
      executionId: "model.jaffle_shop.orders",
    });
    expect(onNavigateTo).toHaveBeenNthCalledWith(3, "runs", {
      executionId: "model.jaffle_shop.orders",
      resourceId: "model.jaffle_shop.orders",
    });
    expect(onNavigateTo).toHaveBeenNthCalledWith(4, "health");
  });

  it("disables unavailable pivots when context is partial", () => {
    const onNavigateTo = vi.fn();
    const actions = buildCrossViewPivotActions({
      context: {
        resourceId: "source.jaffle_shop.raw_customers",
        executionId: null,
      },
      onNavigateTo,
      includeHealth: false,
      includeInventoryTab: "lineage",
    });

    expect(actions.map((action) => [action.key, action.disabled])).toEqual([
      ["inventory", false],
      ["timeline", false],
      ["runs", true],
    ]);

    actions[0]?.onClick();
    actions[1]?.onClick();
    actions[2]?.onClick();

    expect(onNavigateTo).toHaveBeenNthCalledWith(1, "inventory", {
      resourceId: "source.jaffle_shop.raw_customers",
      assetTab: "lineage",
      rootResourceId: "source.jaffle_shop.raw_customers",
    });
    expect(onNavigateTo).toHaveBeenNthCalledWith(2, "timeline", {
      resourceId: "source.jaffle_shop.raw_customers",
    });
    expect(onNavigateTo).toHaveBeenCalledTimes(2);
  });
});
