// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Card } from "./Card";

afterEach(cleanup);

describe("Card", () => {
  it("renders children", () => {
    render(
      <Card>
        <Card.Body>Hello</Card.Body>
      </Card>,
    );
    expect(screen.getByText("Hello")).toBeDefined();
  });

  it("applies elevation class", () => {
    const { container } = render(
      <Card elevation="elevated">
        <Card.Body>Content</Card.Body>
      </Card>,
    );
    expect(container.firstElementChild?.className).toContain(
      "ui-card--elevated",
    );
  });

  it("applies compact class", () => {
    const { container } = render(
      <Card compact>
        <Card.Body>Content</Card.Body>
      </Card>,
    );
    expect(container.firstElementChild?.className).toContain(
      "ui-card--compact",
    );
  });

  it("renders header, body, and footer", () => {
    render(
      <Card>
        <Card.Header>
          <h3>Title</h3>
        </Card.Header>
        <Card.Body>Body text</Card.Body>
        <Card.Footer>Footer</Card.Footer>
      </Card>,
    );
    expect(screen.getByText("Title")).toBeDefined();
    expect(screen.getByText("Body text")).toBeDefined();
    expect(screen.getByText("Footer")).toBeDefined();
  });
});
