import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ArtifactSourceService,
  type RemoteObjectStoreClient,
} from "./sourceService";

class FakeRemoteClient implements RemoteObjectStoreClient {
  constructor(
    private readonly objects: Array<{
      key: string;
      updatedAtMs: number;
      etag?: string;
      generation?: string;
      bytes?: Uint8Array;
    }>,
  ) {}

  async listObjects(): Promise<
    Array<{
      key: string;
      updatedAtMs: number;
      etag?: string;
      generation?: string;
    }>
  > {
    return this.objects.map(({ bytes: _bytes, ...object }) => object);
  }

  async readObjectBytes(_bucket: string, key: string): Promise<Uint8Array> {
    const object = this.objects.find((candidate) => candidate.key === key);
    if (object?.bytes == null) {
      throw new Error(`Missing bytes for ${key}`);
    }
    return object.bytes;
  }
}

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    }),
  );
});

describe("ArtifactSourceService", () => {
  it("uses the newest complete remote run and keeps a newer candidate pending until switched", async () => {
    const client = new FakeRemoteClient([
      {
        key: "scheduled/2026-03-28T10-00-00Z/manifest.json",
        updatedAtMs: 1_000,
        etag: "manifest-1",
        bytes: new TextEncoder().encode(
          '{"metadata":{"project_name":"run-1"}}',
        ),
      },
      {
        key: "scheduled/2026-03-28T10-00-00Z/run_results.json",
        updatedAtMs: 1_000,
        etag: "results-1",
        bytes: new TextEncoder().encode(
          '{"metadata":{"project_name":"run-1"}}',
        ),
      },
      {
        key: "scheduled/2026-03-29T10-00-00Z/manifest.json",
        updatedAtMs: 2_000,
        etag: "manifest-2",
        bytes: new TextEncoder().encode(
          '{"metadata":{"project_name":"run-2"}}',
        ),
      },
      {
        key: "scheduled/2026-03-29T10-00-00Z/run_results.json",
        updatedAtMs: 2_000,
        etag: "results-2",
        bytes: new TextEncoder().encode(
          '{"metadata":{"project_name":"run-2"}}',
        ),
      },
      {
        key: "scheduled/2026-03-30T10-00-00Z/manifest.json",
        updatedAtMs: 3_000,
        etag: "manifest-3",
      },
    ]);

    const service = new ArtifactSourceService({
      remoteConfig: {
        provider: "s3",
        bucket: "dbt-artifacts",
        prefix: "scheduled",
        pollIntervalMs: 15_000,
      },
      remoteClient: client,
    });

    const initialStatus = await service.getStatus();
    expect(initialStatus.mode).toBe("remote");
    expect(initialStatus.currentRun?.runId).toBe("2026-03-29T10-00-00Z");
    expect(initialStatus.pendingRun).toBeNull();
    expect(initialStatus.pollIntervalMs).toBe(15_000);

    await service.switchToRun("2026-03-28T10-00-00Z");

    const switchedStatus = await service.getStatus();
    expect(switchedStatus.currentRun?.runId).toBe("2026-03-28T10-00-00Z");
    expect(switchedStatus.pendingRun?.runId).toBe("2026-03-29T10-00-00Z");
    expect(switchedStatus.supportsSwitch).toBe(true);

    const payload = await service.getCurrentArtifacts();
    expect(payload?.source).toBe("remote");
    expect(new TextDecoder().decode(payload?.manifestBytes)).toContain("run-1");
    expect(new TextDecoder().decode(payload?.runResultsBytes)).toContain(
      "run-1",
    );
  });

  it("reads the current local preload pair when a target dir is configured", async () => {
    const targetDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "dbt-tools-artifact-source-"),
    );
    tempDirs.push(targetDir);

    await fs.writeFile(
      path.join(targetDir, "manifest.json"),
      '{"metadata":{"project_name":"local-run"}}',
    );
    await fs.writeFile(
      path.join(targetDir, "run_results.json"),
      '{"metadata":{"project_name":"local-run"}}',
    );

    const service = new ArtifactSourceService({
      remoteConfig: null,
      targetDir,
    });

    const status = await service.getStatus();
    expect(status.mode).toBe("preload");
    expect(status.currentSource).toBe("preload");
    expect(status.pendingRun).toBeNull();

    const payload = await service.getCurrentArtifacts();
    expect(payload?.source).toBe("preload");
    expect(new TextDecoder().decode(payload?.manifestBytes)).toContain(
      "local-run",
    );
    expect(new TextDecoder().decode(payload?.runResultsBytes)).toContain(
      "local-run",
    );
  });
});
