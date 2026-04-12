import { describe, expect, it } from "vitest";
import {
  joinObjectStorageKey,
  mergeRemoteSourceConfigWithParsedLocation,
  parseArtifactSourceLocation,
} from "./artifact-location";

describe("parseArtifactSourceLocation", () => {
  it("parses s3:// URL", () => {
    const r = parseArtifactSourceLocation(
      "s3",
      "s3://my-bucket/path/to/arts",
      "/tmp",
    );
    expect(r).toEqual({
      kind: "remote",
      provider: "s3",
      bucket: "my-bucket",
      prefix: "path/to/arts",
    });
  });

  it("parses gcs bucket/prefix without scheme", () => {
    const r = parseArtifactSourceLocation(
      "gcs",
      "mybucket/prefix/here",
      "/tmp",
    );
    expect(r).toEqual({
      kind: "remote",
      provider: "gcs",
      bucket: "mybucket",
      prefix: "prefix/here",
    });
  });

  it("throws on empty location", () => {
    expect(() => parseArtifactSourceLocation("local", "   ", "/tmp")).toThrow(
      /required/i,
    );
  });
});

describe("joinObjectStorageKey", () => {
  it("joins prefix and relative", () => {
    expect(joinObjectStorageKey("a/b", "manifest.json")).toBe(
      "a/b/manifest.json",
    );
  });
});

describe("mergeRemoteSourceConfigWithParsedLocation", () => {
  it("inherits S3 options from env when provider matches", () => {
    const merged = mergeRemoteSourceConfigWithParsedLocation(
      {
        provider: "s3",
        bucket: "ignored",
        prefix: "ignored",
        pollIntervalMs: 12_000,
        region: "us-west-2",
        endpoint: "http://localhost:9000",
        forcePathStyle: true,
      },
      {
        kind: "remote",
        provider: "s3",
        bucket: "b",
        prefix: "p",
      },
    );
    expect(merged).toMatchObject({
      provider: "s3",
      bucket: "b",
      prefix: "p",
      pollIntervalMs: 12_000,
      region: "us-west-2",
      endpoint: "http://localhost:9000",
      forcePathStyle: true,
    });
  });
});
