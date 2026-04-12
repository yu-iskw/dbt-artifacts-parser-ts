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
  discoverArtifactCandidates,
  loadDiscoveredArtifactCandidate,
  type ArtifactSourceStatus,
  type RemoteArtifactRun,
  type WorkspaceArtifactSource,
  type DiscoverSourceType,
  type ArtifactDiscoveryResponse,
} from "./artifactSourceApi";
