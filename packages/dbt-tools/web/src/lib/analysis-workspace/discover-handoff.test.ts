import { describe, expect, it } from "vitest";
import {
  buildDiscoverCliCommand,
  buildDiscoverPageUrl,
} from "./discover-handoff";

describe("discover-handoff", () => {
  it("buildDiscoverCliCommand quotes the query for the shell", () => {
    const q = 'foo "bar"';
    expect(buildDiscoverCliCommand(q)).toBe(
      `dbt-tools discover ${JSON.stringify(q)} --json`,
    );
  });

  it("buildDiscoverPageUrl sets inventory view and q", () => {
    const u = new URL(
      buildDiscoverPageUrl("http://localhost:5173/app", "orders"),
    );
    expect(u.searchParams.get("view")).toBe("inventory");
    expect(u.searchParams.get("q")).toBe("orders");
  });

  it("buildDiscoverPageUrl drops q when query blank", () => {
    const u = new URL(buildDiscoverPageUrl("http://localhost:5173/?x=1", "  "));
    expect(u.searchParams.get("view")).toBe("inventory");
    expect(u.searchParams.has("q")).toBe(false);
    expect(u.searchParams.get("x")).toBe("1");
  });
});
