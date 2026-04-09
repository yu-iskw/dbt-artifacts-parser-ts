import { describe, expect, it } from "vitest";
import { composePrCaptureComment } from "./compose-pr-capture-comment";
import type { CaptureManifest } from "./resolve-pr-capture-targets";

describe("composePrCaptureComment", () => {
  it("renders table and download links for two targets", () => {
    const manifest: CaptureManifest = {
      version: 1,
      targets: [
        { id: "health", title: "Health", file: "health.png" },
        { id: "timeline", title: "Timeline", file: "timeline.png" },
      ],
    };
    const md = composePrCaptureComment({
      manifest,
      screenshotArtifactUrl: "https://example.com/screens.zip",
      videoArtifactUrl: "https://example.com/videos.zip",
      captureRulesUrl:
        "https://github.com/o/r/blob/abc/packages/dbt-tools/web/capture-rules.json",
    });
    expect(md).toContain("<!-- pr-captures -->");
    expect(md).toContain("| Health | `health.png` | `health.webm` |");
    expect(md).toContain("| Timeline | `timeline.png` | `timeline.webm` |");
    expect(md).toContain(
      "[Download screenshots (artifact)](https://example.com/screens.zip)",
    );
    expect(md).toContain(
      "[Download demo videos (artifact)](https://example.com/videos.zip)",
    );
    expect(md).toContain(
      "[capture-rules.json](https://github.com/o/r/blob/abc/packages/dbt-tools/web/capture-rules.json)",
    );
  });

  it("renders a single target", () => {
    const manifest: CaptureManifest = {
      version: 1,
      targets: [{ id: "runs", title: "Runs", file: "runs.png" }],
    };
    const md = composePrCaptureComment({
      manifest,
      screenshotArtifactUrl: "https://a.test/s.png",
      videoArtifactUrl: "https://a.test/v.png",
    });
    expect(md).toContain("| Runs | `runs.png` | `runs.webm` |");
  });

  it("handles empty manifest", () => {
    const md = composePrCaptureComment({
      manifest: { version: 1, targets: [] },
      screenshotArtifactUrl: "https://x",
    });
    expect(md).toContain("<!-- pr-captures -->");
    expect(md).toContain("No UI capture targets");
    expect(md).not.toContain("| --- |");
  });

  it("omits artifact bullets when URLs missing but keeps footer", () => {
    const md = composePrCaptureComment({
      manifest: {
        version: 1,
        targets: [{ id: "health", title: "Health", file: "health.png" }],
      },
    });
    expect(md).toContain("Artifact URLs were not provided");
    expect(md).not.toContain("[Download screenshots");
  });

  it("includes truncated notice when set", () => {
    const md = composePrCaptureComment({
      manifest: {
        version: 1,
        targets: [{ id: "health", title: "Health", file: "health.png" }],
        truncated: true,
        totalMatched: 9,
      },
    });
    expect(md).toContain("Showing 1 of 9");
  });

  it("throws when body would exceed GitHub comment limits", () => {
    const big: CaptureManifest = {
      version: 1,
      targets: Array.from({ length: 2000 }, (_, i) => ({
        id: `t${i}`,
        title: "x".repeat(500),
        file: `${i}.png`,
      })),
    };
    expect(() =>
      composePrCaptureComment({
        manifest: big,
        screenshotArtifactUrl: "https://a",
      }),
    ).toThrow(/exceeds safe size/);
  });
});
