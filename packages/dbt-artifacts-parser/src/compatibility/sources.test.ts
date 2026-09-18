import { describe, it, expect } from "vitest";
import {
  canonicalSourcesV3Status,
  isFusionSourcesStatusAlias,
  normalizeSourcesV3ProducerStatus,
} from "./sources";

const FUSION_STATUSES = ["Pass", "Warn", "Error"] as const;
const CANONICAL_STATUSES = ["pass", "warn", "error"] as const;

describe("sources v3 producer compatibility", () => {
  it.each(
    FUSION_STATUSES.map((alias, index) => [alias, CANONICAL_STATUSES[index]]),
  )("maps %s to %s", (alias, canonical) => {
    expect(isFusionSourcesStatusAlias(alias)).toBe(true);
    expect(canonicalSourcesV3Status(alias)).toBe(canonical);
  });

  it("does not treat lowercase or runtime-error values as Fusion aliases", () => {
    expect(isFusionSourcesStatusAlias("pass")).toBe(false);
    expect(isFusionSourcesStatusAlias("runtime error")).toBe(false);
    expect(isFusionSourcesStatusAlias("Runtime Error")).toBe(false);
  });

  it("normalizes only result status fields and does not mutate the input", () => {
    const artifact: Record<string, unknown> = {
      nested: { status: "Pass" },
      results: [
        { unique_id: "source.compat.raw.orders", status: "Pass" },
        { unique_id: "source.compat.raw.customers", status: "pass" },
        { unique_id: "source.compat.raw.payments", status: "runtime error" },
      ],
    };

    const normalized = normalizeSourcesV3ProducerStatus(artifact);
    const results = normalized.results as Array<Record<string, unknown>>;

    expect(normalized).not.toBe(artifact);
    expect(results[0]?.status).toBe("pass");
    expect(results[1]?.status).toBe("pass");
    expect(results[2]?.status).toBe("runtime error");
    expect((normalized.nested as Record<string, unknown>).status).toBe("Pass");
    expect(
      (artifact.results as Array<Record<string, unknown>>)[0]?.status,
    ).toBe("Pass");
  });

  it("returns the original object when no Fusion aliases are present", () => {
    const artifact: Record<string, unknown> = {
      results: [{ unique_id: "source.compat.raw.orders", status: "pass" }],
    };
    expect(normalizeSourcesV3ProducerStatus(artifact)).toBe(artifact);
  });

  it("leaves artifacts without a results array unchanged", () => {
    const artifact: Record<string, unknown> = { metadata: {} };
    expect(normalizeSourcesV3ProducerStatus(artifact)).toBe(artifact);
  });

  it("leaves non-object result rows unchanged", () => {
    const artifact: Record<string, unknown> = {
      results: [null, "Pass", 12],
    };
    expect(normalizeSourcesV3ProducerStatus(artifact)).toBe(artifact);
  });
});
