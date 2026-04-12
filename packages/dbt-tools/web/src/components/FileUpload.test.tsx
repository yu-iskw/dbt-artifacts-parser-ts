// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockDiscover, mockLoadCandidate, mockRefetch } = vi.hoisted(() => ({
  mockDiscover: vi.fn(),
  mockLoadCandidate: vi.fn(),
  mockRefetch: vi.fn(),
}));

vi.mock("@web/services/artifactApi", () => ({
  discoverArtifactCandidates: (...args: unknown[]) => mockDiscover(...args),
  loadDiscoveredArtifactCandidate: (...args: unknown[]) =>
    mockLoadCandidate(...args),
  refetchFromApi: (...args: unknown[]) => mockRefetch(...args),
}));

vi.mock("./ui/Toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { FileUpload } from "./FileUpload";

describe("FileUpload", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    mockDiscover.mockReset();
    mockLoadCandidate.mockReset();
    mockRefetch.mockReset();

    mockDiscover.mockResolvedValue({
      sourceType: "local",
      location: expect.any(String),
      candidates: [
        {
          candidateId: "current",
          label: "current",
          missingRequired: [],
          missingOptional: ["catalog.json", "sources.json"],
          warnings: ["Optional artifact missing: catalog.json"],
          features: { catalogMetadata: false, sourceFreshness: false },
          isLoadable: true,
        },
      ],
    });

    mockLoadCandidate.mockResolvedValue({ currentSource: "preload" });
    mockRefetch.mockResolvedValue({
      analysis: { summary: { total_nodes: 3 } },
      metrics: { source: "preload" },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("discovers and loads selected candidate", async () => {
    const onAnalysis = vi.fn();
    const onError = vi.fn();

    await act(async () => {
      root.render(<FileUpload onAnalysis={onAnalysis} onError={onError} />);
    });

    const locationInput = container.querySelector("input") as HTMLInputElement;
    await act(async () => {
      locationInput.value = "/tmp/target";
      locationInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      (
        [...container.querySelectorAll("button")].find((button) =>
          button.textContent?.includes("Discover artifact sets"),
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const loadButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Load selected artifacts"),
    ) as HTMLButtonElement | undefined;
    expect(loadButton).toBeDefined();

    await act(async () => {
      loadButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockDiscover).toHaveBeenCalled();
    expect(mockLoadCandidate).toHaveBeenCalledWith({
      sourceType: "local",
      location: expect.any(String),
      candidateId: "current",
    });
    expect(onAnalysis).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalledWith(expect.any(String));
  });

  it("reports discovery errors", async () => {
    mockDiscover.mockRejectedValueOnce(new Error("Bad location"));

    const onAnalysis = vi.fn();
    const onError = vi.fn();

    await act(async () => {
      root.render(<FileUpload onAnalysis={onAnalysis} onError={onError} />);
    });

    const locationInput = container.querySelector("input") as HTMLInputElement;
    await act(async () => {
      locationInput.value = "/tmp/target";
      locationInput.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      (
        [...container.querySelectorAll("button")].find((button) =>
          button.textContent?.includes("Discover artifact sets"),
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledWith("Bad location");
    expect(onAnalysis).not.toHaveBeenCalled();
  });
});
