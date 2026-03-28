// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "./AppSidebar";

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

function renderSidebar({
  sidebarCollapsed = false,
  onNavigate = vi.fn<() => void>(),
  setNavigationTarget = vi.fn<(target: { view: string }) => void>(),
}: {
  sidebarCollapsed?: boolean;
  onNavigate?: () => void;
  setNavigationTarget?: (target: { view: string }) => void;
} = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const setSidebarCollapsed = vi.fn();

  act(() => {
    root.render(
      <AppSidebar
        activeView="health"
        setNavigationTarget={setNavigationTarget}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        onNavigate={onNavigate}
        analysis={null}
        analysisSource={null}
      />,
    );
  });

  return {
    container,
    root,
    onNavigate,
    setNavigationTarget,
    setSidebarCollapsed,
  };
}

function cleanupRoot(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
  document.body.innerHTML = "";
});

describe("AppSidebar branding", () => {
  it("renders the shared SVG logo instead of the old text badge", () => {
    const { container, root } = renderSidebar();
    const brandLink = container.querySelector(".app-sidebar__brand-link");
    const logo = brandLink?.querySelector("img");

    expect(brandLink).not.toBeNull();
    expect(logo?.getAttribute("src")).toContain("image/svg+xml");
    expect(container.querySelector(".brand-mark")).toBeNull();

    cleanupRoot(root, container);
  });

  it("keeps the health navigation action on the brand button", () => {
    const { container, root, onNavigate, setNavigationTarget } =
      renderSidebar();
    const brandButton = container.querySelector(
      ".app-sidebar__brand-link",
    ) as HTMLButtonElement;

    act(() => {
      brandButton.click();
    });

    expect(setNavigationTarget).toHaveBeenCalledWith({ view: "health" });
    expect(onNavigate).toHaveBeenCalled();

    cleanupRoot(root, container);
  });
});
