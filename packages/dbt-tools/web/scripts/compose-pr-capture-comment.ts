/**
 * Builds Markdown for a PR comment that links to screenshot and video artifacts.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { CaptureManifest } from "./resolve-pr-capture-targets";

const MARKER = "<!-- pr-captures -->";

export type ComposePrCaptureCommentInput = {
  manifest: CaptureManifest;
  /** Download URL for the screenshots artifact (PNG zip). */
  screenshotArtifactUrl?: string;
  /** Download URL for the videos artifact (WebM). */
  videoArtifactUrl?: string;
  /** Link shown for capture-rules.json (e.g. blob URL at commit SHA). */
  captureRulesUrl?: string;
};

export function composePrCaptureComment(
  input: ComposePrCaptureCommentInput,
): string {
  const { manifest, screenshotArtifactUrl, videoArtifactUrl, captureRulesUrl } =
    input;

  const lines: string[] = [MARKER, "", "## Visual captures", ""];

  if (!manifest.targets.length) {
    lines.push("_No UI capture targets resolved for this change._");
    lines.push("");
    return lines.join("\n");
  }

  lines.push(
    "Automated screenshots and demo videos use the **jaffle_shop** fixture data (mocked `/api/*` routes), same as Playwright E2E.",
    "",
  );

  lines.push("| View | Screenshot | Demo video |");
  lines.push("| --- | --- | --- |");

  for (const t of manifest.targets) {
    const png = `\`${t.file}\``;
    const vid = `\`${t.id}.webm\``;
    lines.push(`| ${t.title} | ${png} | ${vid} |`);
  }

  lines.push("");

  if (manifest.truncated) {
    lines.push(
      `> Showing ${manifest.targets.length} of ${manifest.totalMatched ?? manifest.targets.length} matched view(s) (cap).`,
      "",
    );
  }

  const downloads: string[] = [];
  if (screenshotArtifactUrl) {
    downloads.push(
      `- [Download screenshots (artifact)](${screenshotArtifactUrl})`,
    );
  }
  if (videoArtifactUrl) {
    downloads.push(`- [Download demo videos (artifact)](${videoArtifactUrl})`);
  }

  if (downloads.length) {
    lines.push("**Artifacts** (GitHub login required):", "", ...downloads, "");
  } else {
    lines.push(
      "_Artifact URLs were not provided; download captures from the workflow run’s Artifacts section._",
      "",
    );
  }

  if (captureRulesUrl) {
    lines.push(
      `Configure which paths trigger which views in [capture-rules.json](${captureRulesUrl}).`,
      "",
    );
  }

  lines.push(
    "---",
    "",
    "_This comment is updated by the `pr-captures` workflow on each push._",
  );

  const body = lines.join("\n");
  if (body.length > 60_000) {
    throw new Error("Comment body exceeds safe size for GitHub issue comments");
  }
  return body;
}

function readManifestFromPath(manifestPath: string): CaptureManifest {
  const raw = fs.readFileSync(manifestPath, "utf8");
  return JSON.parse(raw) as CaptureManifest;
}

function parseArgs(argv: string[]): {
  manifest: string;
  out?: string;
} {
  let manifest =
    "packages/dbt-tools/web/pr-capture-artifacts/capture-manifest.json";
  let out: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest" && argv[i + 1]) {
      manifest = argv[++i];
    } else if (a === "--out" && argv[i + 1]) {
      out = argv[++i];
    }
  }

  return { manifest, out };
}

function main(): void {
  const { manifest: manifestRel, out: outRel } = parseArgs(
    process.argv.slice(2),
  );
  const cwd = process.cwd();
  const manifestPath = path.isAbsolute(manifestRel)
    ? manifestRel
    : path.resolve(cwd, manifestRel);

  const manifest = readManifestFromPath(manifestPath);
  const body = composePrCaptureComment({
    manifest,
    screenshotArtifactUrl: process.env.PR_CAPTURE_SCREENSHOT_ARTIFACT_URL,
    videoArtifactUrl: process.env.PR_CAPTURE_VIDEO_ARTIFACT_URL,
    captureRulesUrl: process.env.PR_CAPTURE_RULES_BLOB_URL,
  });

  if (outRel) {
    const outPath = path.isAbsolute(outRel)
      ? outRel
      : path.resolve(cwd, outRel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, body, "utf8");
    process.stdout.write(`Wrote ${outPath}\n`);
  } else {
    process.stdout.write(body);
  }
}

const entryArg = process.argv[1];
if (
  entryArg &&
  import.meta.url === pathToFileURL(path.resolve(entryArg)).href
) {
  main();
}
