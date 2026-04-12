import fs from "node:fs/promises";
import path from "node:path";
import {
  DBT_CATALOG_JSON,
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
  DBT_SOURCES_JSON,
} from "./artifact-filenames";

export type ArtifactSourceType = "local" | "s3" | "gcs";

export const REQUIRED_ARTIFACT_FILENAMES = [
  DBT_MANIFEST_JSON,
  DBT_RUN_RESULTS_JSON,
] as const;
export const OPTIONAL_ARTIFACT_FILENAMES = [
  DBT_CATALOG_JSON,
  DBT_SOURCES_JSON,
] as const;

export type RequiredArtifactFilename =
  (typeof REQUIRED_ARTIFACT_FILENAMES)[number];
export type OptionalArtifactFilename =
  (typeof OPTIONAL_ARTIFACT_FILENAMES)[number];
export type SupportedArtifactFilename =
  | RequiredArtifactFilename
  | OptionalArtifactFilename;

const SUPPORTED_ARTIFACT_SET = new Set<SupportedArtifactFilename>([
  ...REQUIRED_ARTIFACT_FILENAMES,
  ...OPTIONAL_ARTIFACT_FILENAMES,
]);

export interface DiscoveredArtifactFile {
  relativePath: string;
  filename: SupportedArtifactFilename;
  updatedAtMs?: number;
}

export interface ArtifactCandidateFeatures {
  catalogMetadata: boolean;
  sourceFreshness: boolean;
}

export interface ArtifactCandidateSet {
  candidateId: string;
  label: string;
  artifacts: Partial<Record<SupportedArtifactFilename, DiscoveredArtifactFile>>;
  missingRequired: RequiredArtifactFilename[];
  missingOptional: OptionalArtifactFilename[];
  warnings: string[];
  features: ArtifactCandidateFeatures;
  isLoadable: boolean;
}

export interface ArtifactDiscoveryResult {
  sourceType: ArtifactSourceType;
  location: string;
  candidates: ArtifactCandidateSet[];
}

function toCandidateId(relativePath: string): string {
  const dir = path.posix.dirname(relativePath);
  return dir === "." ? "current" : dir;
}

function featureFlags(
  artifacts: Partial<Record<SupportedArtifactFilename, DiscoveredArtifactFile>>,
): ArtifactCandidateFeatures {
  return {
    catalogMetadata: artifacts[DBT_CATALOG_JSON] != null,
    sourceFreshness: artifacts[DBT_SOURCES_JSON] != null,
  };
}

function buildCandidate(
  candidateId: string,
  artifacts: Partial<Record<SupportedArtifactFilename, DiscoveredArtifactFile>>,
): ArtifactCandidateSet {
  const missingRequired = REQUIRED_ARTIFACT_FILENAMES.filter(
    (filename) => artifacts[filename] == null,
  );
  const missingOptional = OPTIONAL_ARTIFACT_FILENAMES.filter(
    (filename) => artifacts[filename] == null,
  );

  return {
    candidateId,
    label: candidateId === "current" ? "current" : candidateId,
    artifacts,
    missingRequired,
    missingOptional,
    warnings: missingOptional.map(
      (name) =>
        `Optional artifact missing: ${name}. Related features will be disabled.`,
    ),
    features: featureFlags(artifacts),
    isLoadable: missingRequired.length === 0,
  };
}

export function discoverArtifactCandidateSets(
  files: readonly DiscoveredArtifactFile[],
): ArtifactCandidateSet[] {
  const grouped = new Map<
    string,
    Partial<Record<SupportedArtifactFilename, DiscoveredArtifactFile>>
  >();

  for (const file of files) {
    const candidateId = toCandidateId(file.relativePath);
    const group = grouped.get(candidateId) ?? {};
    group[file.filename] = file;
    grouped.set(candidateId, group);
  }

  return [...grouped.entries()]
    .map(([candidateId, artifacts]) => buildCandidate(candidateId, artifacts))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));
}

async function maybePushArtifactFile(
  files: DiscoveredArtifactFile[],
  baseDir: string,
  relativePath: string,
): Promise<void> {
  const filename = path.posix.basename(
    relativePath,
  ) as SupportedArtifactFilename;
  if (!SUPPORTED_ARTIFACT_SET.has(filename)) return;
  const stat = await fs.stat(path.join(baseDir, relativePath));
  files.push({ relativePath, filename, updatedAtMs: stat.mtimeMs });
}

async function collectChildDirectoryArtifacts(
  files: DiscoveredArtifactFile[],
  location: string,
  dirName: string,
): Promise<void> {
  const childDir = path.join(location, dirName);
  const childEntries = await fs.readdir(childDir, { withFileTypes: true });
  for (const child of childEntries) {
    if (!child.isFile()) continue;
    await maybePushArtifactFile(files, location, `${dirName}/${child.name}`);
  }
}

export async function discoverLocalArtifactFiles(
  location: string,
): Promise<DiscoveredArtifactFile[]> {
  const top = await fs.readdir(location, { withFileTypes: true });
  const files: DiscoveredArtifactFile[] = [];

  for (const entry of top) {
    if (entry.isFile()) {
      await maybePushArtifactFile(files, location, entry.name);
      continue;
    }
    if (!entry.isDirectory()) continue;
    await collectChildDirectoryArtifacts(files, location, entry.name);
  }

  return files;
}

export function selectArtifactCandidate(
  candidates: readonly ArtifactCandidateSet[],
  candidateId?: string,
): ArtifactCandidateSet {
  if (candidates.length === 0) {
    throw new Error(
      "No supported dbt artifacts were discovered at this location.",
    );
  }

  if (candidateId == null || candidateId.trim() === "") {
    if (candidates.length === 1) return candidates[0]!;
    throw new Error(
      "Multiple candidate artifact sets were discovered. Select one explicitly.",
    );
  }

  const selected = candidates.find(
    (candidate) => candidate.candidateId === candidateId,
  );
  if (selected == null) {
    throw new Error(`Unknown artifact candidate: ${candidateId}`);
  }
  return selected;
}

export function validateRequiredArtifacts(
  candidate: ArtifactCandidateSet,
): void {
  if (candidate.missingRequired.length === 0) return;
  throw new Error(
    `Missing required artifact(s): ${candidate.missingRequired.join(", ")}. manifest.json and run_results.json are required.`,
  );
}
