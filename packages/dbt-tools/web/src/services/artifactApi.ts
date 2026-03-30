/**
 * Public facade: artifact-source HTTP client and types. Implementation:
 * `artifactSourceApi.ts` (fetch + run switching); server-side resolution:
 * `artifact-source/sourceService.ts`.
 */
export {
  fetchArtifactSourceStatus,
  loadCurrentManagedArtifacts,
  refetchFromApi,
  switchToArtifactRun,
  type ArtifactSourceStatus,
  type RemoteArtifactRun,
  type WorkspaceArtifactSource,
} from "./artifactSourceApi";
