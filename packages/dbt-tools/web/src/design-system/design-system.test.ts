import { describe, it, expect } from "vitest";
import { DsButton, DsCard, DsInput } from "@web/design-system";

describe("design-system", () => {
  it("exports foundational components", () => {
    expect(typeof DsButton).toBe("function");
    expect(typeof DsCard).toBe("function");
    expect(typeof DsInput).toBe("function");
  });
});
