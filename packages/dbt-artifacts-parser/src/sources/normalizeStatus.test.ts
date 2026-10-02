import { describe, it, expect } from "vitest";
import { normalizeSourcesResultStatus } from "./normalizeStatus";

describe("normalizeSourcesResultStatus", () => {
  it("maps Pass Warn Error to lowercase", () => {
    const input = {
      metadata: {
        dbt_schema_version: "https://schemas.getdbt.com/dbt/sources/v3.json",
      },
      results: [
        { unique_id: "a", status: "Pass" },
        { unique_id: "b", status: "Warn" },
        { unique_id: "c", status: "Error" },
        { unique_id: "d", status: "pass" },
      ],
    };
    const out = normalizeSourcesResultStatus(input);
    expect(out).not.toBe(input);
    expect(
      (out.results as Array<{ status: string }>).map((r) => r.status),
    ).toEqual(["pass", "warn", "error", "pass"]);
  });

  it("returns the same object when nothing changes", () => {
    const input = {
      results: [{ status: "pass" }],
    };
    expect(normalizeSourcesResultStatus(input)).toBe(input);
  });
});
