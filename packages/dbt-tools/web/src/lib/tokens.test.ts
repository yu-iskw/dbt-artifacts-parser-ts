import { describe, it, expect, expectTypeOf } from "vitest";
import {
  type SemanticCssVar,
  componentVars,
  semanticVars,
  varRef,
} from "@web/lib/tokens";

describe("tokens.generated bridge", () => {
  it("exposes semantic CSS variable names", () => {
    expect(semanticVars["text-primary"]).toBe("--text-primary");
    expect(varRef("bg-canvas")).toBe("var(--bg-canvas)");
  });

  it("exposes component token names for design-system use", () => {
    expect(componentVars["button-primary-bg"]).toBe("--button-primary-bg");
    expectTypeOf("--text-primary").toExtend<SemanticCssVar>();
  });
});
