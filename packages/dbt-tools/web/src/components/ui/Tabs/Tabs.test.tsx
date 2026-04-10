// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./Tabs";

afterEach(cleanup);

describe("Tabs", () => {
  function renderTabs(onTabChange?: (id: string) => void) {
    return render(
      <Tabs defaultTab="a" onTabChange={onTabChange}>
        <Tabs.List label="Test tabs">
          <Tabs.Tab id="a">Tab A</Tabs.Tab>
          <Tabs.Tab id="b">Tab B</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel id="a">Panel A</Tabs.Panel>
        <Tabs.Panel id="b">Panel B</Tabs.Panel>
      </Tabs>,
    );
  }

  it("renders the default panel", () => {
    renderTabs();
    expect(screen.getByText("Panel A")).toBeDefined();
    expect(screen.queryByText("Panel B")).toBeNull();
  });

  it("switches tabs on click", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    renderTabs(handler);

    await user.click(screen.getByRole("tab", { name: "Tab B" }));
    expect(screen.getByText("Panel B")).toBeDefined();
    expect(screen.queryByText("Panel A")).toBeNull();
    expect(handler).toHaveBeenCalledWith("b");
  });

  it("sets aria-selected on active tab", () => {
    renderTabs();
    const tabA = screen.getByRole("tab", { name: "Tab A" });
    const tabB = screen.getByRole("tab", { name: "Tab B" });
    expect(tabA.getAttribute("aria-selected")).toBe("true");
    expect(tabB.getAttribute("aria-selected")).toBe("false");
  });

  it("supports keyboard navigation", async () => {
    const user = userEvent.setup();
    renderTabs();

    const tabA = screen.getByRole("tab", { name: "Tab A" });
    tabA.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByText("Panel B")).toBeDefined();
  });
});
