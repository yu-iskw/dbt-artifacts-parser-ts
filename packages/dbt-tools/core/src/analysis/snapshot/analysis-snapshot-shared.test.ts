import { describe, expect, it } from "vitest";
import { statusTone } from "./analysis-snapshot-shared";

describe("statusTone", () => {
  it("maps dbt skipped and no-op statuses to skipped tone", () => {
    expect(statusTone("skipped")).toBe("skipped");
    expect(statusTone("Skipped")).toBe("skipped");
    expect(statusTone("no op")).toBe("skipped");
    expect(statusTone("NO OP")).toBe("skipped");
  });

  it("maps empty or unknown strings to neutral", () => {
    expect(statusTone(null)).toBe("neutral");
    expect(statusTone(undefined)).toBe("neutral");
    expect(statusTone("")).toBe("neutral");
    expect(statusTone("pending")).toBe("neutral");
    expect(statusTone("queued")).toBe("neutral");
  });

  it.each(["success", "Success", "pass", "PASS", "passed", "Passed"])(
    "maps success-like %s to positive",
    (s) => {
      expect(statusTone(s)).toBe("positive");
    },
  );

  it.each(["warn", "Warn", "warning", "WARNING"])(
    "maps warning-like %s to warning",
    (s) => {
      expect(statusTone(s)).toBe("warning");
    },
  );

  it.each([
    "error",
    "ERROR",
    "errors",
    "fail",
    "failed",
    "failure",
    "failures",
    "errored",
    "run error",
    "RUN ERROR",
    "runtime error",
    "compile error",
    "database error",
  ])("maps failure-like %s to danger", (s) => {
    expect(statusTone(s)).toBe("danger");
  });
});
