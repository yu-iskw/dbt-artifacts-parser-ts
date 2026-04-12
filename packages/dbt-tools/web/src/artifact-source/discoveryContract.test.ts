import { describe, expect, it } from "vitest";
import {
  DBT_CATALOG_JSON,
  DBT_SOURCES_JSON,
} from "@dbt-tools/core";
import {
  getDisabledCapabilities,
  ARTIFACT_CAPABILITIES,
} from "../lib/artifactCapabilities";

describe("getDisabledCapabilities", () => {
  it("returns empty array when no optional artifacts are missing", () => {
    expect(getDisabledCapabilities([])).toHaveLength(0);
  });

  it("returns catalog-dependent capabilities when catalog.json is missing", () => {
    const disabled = getDisabledCapabilities([DBT_CATALOG_JSON]);
    const keys = disabled.map((c) => c.key);
    expect(keys).toContain("field-level-lineage");
    expect(keys).toContain("column-metadata");
    expect(keys).not.toContain("source-freshness");
  });

  it("returns sources-dependent capabilities when sources.json is missing", () => {
    const disabled = getDisabledCapabilities([DBT_SOURCES_JSON]);
    const keys = disabled.map((c) => c.key);
    expect(keys).toContain("source-freshness");
    expect(keys).not.toContain("field-level-lineage");
    expect(keys).not.toContain("column-metadata");
  });

  it("returns all capabilities when both optional artifacts are missing", () => {
    const disabled = getDisabledCapabilities([
      DBT_CATALOG_JSON,
      DBT_SOURCES_JSON,
    ]);
    expect(disabled).toHaveLength(ARTIFACT_CAPABILITIES.length);
  });

  it("does not return capabilities for unknown artifact names", () => {
    const disabled = getDisabledCapabilities(["unknown-artifact.json"]);
    expect(disabled).toHaveLength(0);
  });
});
