import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadAnalysisFromBuffers } = vi.hoisted(() => ({
  loadAnalysisFromBuffers: vi.fn(),
}));

vi.mock("./analysisLoader", () => ({
  loadAnalysisFromBuffers,
}));

import {
  fetchArtifactSourceStatus,
  loadCurrentManagedArtifacts,
} from "./artifactSourceApi";

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("artifactSourceApi", () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    loadAnalysisFromBuffers.mockReset();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("falls back to legacy artifacts when artifact source status returns 404", async () => {
    const analysisResult = {
      analysis: { projectName: "legacy-run" },
      metrics: { source: "preload" },
    };
    loadAnalysisFromBuffers.mockResolvedValue(analysisResult);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response("manifest"))
      .mockResolvedValueOnce(new Response("run-results"));

    const result = await loadCurrentManagedArtifacts();

    expect(result).toEqual({
      status: expect.objectContaining({
        mode: "preload",
        currentSource: "preload",
        label: "Live target",
      }),
      result: analysisResult,
    });
    expect(loadAnalysisFromBuffers).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      expect.any(ArrayBuffer),
      "preload",
    );
  });

  it("falls back to legacy artifacts when artifact source status returns 500", async () => {
    const analysisResult = {
      analysis: { projectName: "legacy-run" },
      metrics: { source: "preload" },
    };
    loadAnalysisFromBuffers.mockResolvedValue(analysisResult);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response("manifest"))
      .mockResolvedValueOnce(new Response("run-results"));

    const result = await loadCurrentManagedArtifacts();

    expect(result.status).toEqual(
      expect.objectContaining({
        mode: "preload",
        currentSource: "preload",
        label: "Live target",
      }),
    );
    expect(result.result).toBe(analysisResult);
  });

  it("falls back to legacy artifacts when artifact source status fetch throws", async () => {
    const analysisResult = {
      analysis: { projectName: "legacy-run" },
      metrics: { source: "preload" },
    };
    loadAnalysisFromBuffers.mockResolvedValue(analysisResult);
    fetchMock
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(new Response("manifest"))
      .mockResolvedValueOnce(new Response("run-results"));

    const result = await loadCurrentManagedArtifacts();

    expect(result.status).toEqual(
      expect.objectContaining({
        mode: "preload",
        currentSource: "preload",
        label: "Live target",
      }),
    );
    expect(result.result).toBe(analysisResult);
  });

  it("returns waiting status when artifact source fails and legacy artifacts are unavailable", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const result = await loadCurrentManagedArtifacts();

    expect(result).toEqual({
      status: expect.objectContaining({
        mode: "none",
        currentSource: null,
        label: "Waiting for artifacts",
      }),
      result: null,
    });
    expect(loadAnalysisFromBuffers).not.toHaveBeenCalled();
  });

  it("does not fall back when the artifact source endpoint reports no managed source", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        mode: "none",
        currentSource: null,
        label: "Waiting for artifacts",
        checkedAtMs: 123,
        remoteProvider: null,
        remoteLocation: null,
        pollIntervalMs: null,
        currentRun: null,
        pendingRun: null,
        supportsSwitch: false,
      }),
    );

    const result = await loadCurrentManagedArtifacts();

    expect(result).toEqual({
      status: {
        mode: "none",
        currentSource: null,
        label: "Waiting for artifacts",
        checkedAtMs: 123,
        remoteProvider: null,
        remoteLocation: null,
        pollIntervalMs: null,
        currentRun: null,
        pendingRun: null,
        supportsSwitch: false,
      },
      result: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps fetchArtifactSourceStatus strict for non-ok responses", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(fetchArtifactSourceStatus()).rejects.toThrow(
      "Failed to load artifact source status",
    );
  });
});
