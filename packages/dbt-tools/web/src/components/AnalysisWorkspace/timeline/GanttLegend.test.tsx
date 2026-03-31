// @vitest-environment jsdom

import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GanttLegend } from "./GanttLegend";

vi.mock("@web/hooks/useTheme", () => ({
  useSyncedDocumentTheme: () => "light",
}));

function renderLegend(
  props: Omit<
    ComponentProps<typeof GanttLegend>,
    "statusCounts" | "typeCounts"
  > & {
    statusCounts?: Record<string, number>;
    typeCounts?: Record<string, number>;
  },
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <GanttLegend
        statusCounts={props.statusCounts ?? {}}
        typeCounts={props.typeCounts ?? {}}
        showBarEncodingKey={props.showBarEncodingKey ?? false}
        {...props}
      />,
    );
  });
  return { container, root };
}

function cleanupRoot(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("GanttLegend", () => {
  it("lists primary types with zero counts when absent from typeCounts", () => {
    const { container, root } = renderLegend({
      typeCounts: { model: 5 },
      showBarEncodingKey: false,
    });

    const typeGroup = container.querySelector(".gantt-legend__group");
    expect(typeGroup).not.toBeNull();

    const items = container.querySelectorAll(".gantt-legend__item");
    const sourceItem = [...items].find((el) =>
      el.textContent?.includes("source"),
    );
    const seedItem = [...items].find((el) => el.textContent?.includes("seed"));
    expect(sourceItem?.textContent).toMatch(/0/);
    expect(seedItem?.textContent).toMatch(/0/);

    cleanupRoot(root, container);
  });

  it("calls onToggleType when a zero-count primary type chip is clicked", () => {
    const onToggleType = vi.fn();
    const { container, root } = renderLegend({
      typeCounts: { model: 1 },
      showBarEncodingKey: false,
      activeTypes: new Set(["model"]),
      onToggleType,
    });

    const sourceButton = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("source"),
    );
    expect(sourceButton).toBeDefined();
    act(() => {
      sourceButton!.click();
    });
    expect(onToggleType).toHaveBeenCalledWith("source");

    cleanupRoot(root, container);
  });
});
