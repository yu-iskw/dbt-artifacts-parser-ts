/**
 * Resolves which PR UI capture targets apply from a list of changed file paths
 * and writes capture-manifest.json for Playwright + PR comment steps.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { minimatch } from "minimatch";

const MAX_TARGETS = 8;

export type CaptureRule = { globs: string[]; targets: string[] };
export type CaptureRulesFile = { version: number; rules: CaptureRule[] };
export type CaptureManifestTarget = {
  id: string;
  title: string;
  file: string;
};
export type CaptureManifest = {
  version: number;
  targets: CaptureManifestTarget[];
  truncated?: boolean;
  totalMatched?: number;
};

const TITLES: Record<string, string> = {
  health: "Health",
  timeline: "Timeline",
  inventory: "Inventory",
  "inventory-lineage": "Inventory — Lineage",
  runs: "Runs",
};

export function resolvePrCaptureTargets(
  changedPaths: string[],
  rulesFile: CaptureRulesFile,
): CaptureManifest {
  const ids = new Set<string>();
  const normalized = changedPaths
    .map((p) => p.trim().replace(/\\/g, "/"))
    .filter(Boolean);

  for (const line of normalized) {
    for (const rule of rulesFile.rules) {
      if (
        rule.globs.some((g) =>
          minimatch(line, g, { dot: true, matchBase: false }),
        )
      ) {
        for (const t of rule.targets) {
          ids.add(t);
        }
      }
    }
  }

  const sorted = [...ids].sort((a, b) => a.localeCompare(b));
  const totalMatched = sorted.length;
  const capped = sorted.slice(0, MAX_TARGETS);

  return {
    version: 1,
    targets: capped.map((id) => ({
      id,
      title: TITLES[id] ?? id,
      file: `${id}.png`,
    })),
    truncated: totalMatched > MAX_TARGETS,
    totalMatched,
  };
}

function readRules(rulesPath: string): CaptureRulesFile {
  const raw = fs.readFileSync(rulesPath, "utf8");
  return JSON.parse(raw) as CaptureRulesFile;
}

function parseArgs(argv: string[]): {
  changedFile?: string;
  rules: string;
  out: string;
} {
  let changedFile: string | undefined;
  let rules = "packages/dbt-tools/web/capture-rules.json";
  let out = "packages/dbt-tools/web/pr-capture-artifacts/capture-manifest.json";

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--changed" && argv[i + 1]) {
      changedFile = argv[++i];
    } else if (a === "--rules" && argv[i + 1]) {
      rules = argv[++i];
    } else if (a === "--out" && argv[i + 1]) {
      out = argv[++i];
    }
  }

  return { changedFile, rules, out };
}

function main(): void {
  const {
    changedFile,
    rules: rulesRel,
    out: outRel,
  } = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const rulesPath = path.isAbsolute(rulesRel)
    ? rulesRel
    : path.resolve(cwd, rulesRel);
  const outPath = path.isAbsolute(outRel) ? outRel : path.resolve(cwd, outRel);

  if (!changedFile) {
    process.stderr.write(
      "Usage: resolve-pr-capture-targets --changed <path-list-file> [--rules <path>] [--out <path>]\n",
    );
    process.exit(1);
  }
  const p = path.isAbsolute(changedFile)
    ? changedFile
    : path.resolve(cwd, changedFile);
  const changedPaths = fs.readFileSync(p, "utf8").split(/\r?\n/);

  const rules = readRules(rulesPath);
  const manifest = resolvePrCaptureTargets(changedPaths, rules);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const n = manifest.targets.length;
  process.stdout.write(
    `Resolved ${n} capture target(s)${manifest.truncated ? " (truncated)" : ""} -> ${outPath}\n`,
  );
}

const entryArg = process.argv[1];
if (
  entryArg &&
  import.meta.url === pathToFileURL(path.resolve(entryArg)).href
) {
  main();
}
