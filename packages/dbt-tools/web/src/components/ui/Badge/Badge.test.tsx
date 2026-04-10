// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

afterEach(cleanup);

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Status</Badge>);
    expect(screen.getByText("Status")).toBeDefined();
  });

  it("applies tone class", () => {
    const { container } = render(<Badge tone="danger">Error</Badge>);
    expect(container.firstElementChild?.className).toContain(
      "ui-badge--danger",
    );
  });

  it("renders dot when requested", () => {
    const { container } = render(
      <Badge tone="success" dot>
        OK
      </Badge>,
    );
    const dot = container.querySelector(".ui-badge__dot");
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
  });

  it("does not render dot by default", () => {
    const { container } = render(<Badge>Plain</Badge>);
    expect(container.querySelector(".ui-badge__dot")).toBeNull();
  });
});
