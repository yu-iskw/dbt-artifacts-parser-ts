// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadAnalysisFromBuffers } = vi.hoisted(() => ({
  loadAnalysisFromBuffers: vi.fn(),
}));

vi.mock("../services/analysisLoader", () => ({
  loadAnalysisFromBuffers,
}));

import { FileUpload } from "./FileUpload";

function createFile(name: string, contents: string): File {
  return new File([contents], name, { type: "application/json" });
}

async function setInputFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("FileUpload", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    loadAnalysisFromBuffers.mockReset();
    loadAnalysisFromBuffers.mockResolvedValue({
      analysis: {
        summary: { total_nodes: 4 },
      },
      metrics: { source: "upload" },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("uploads the required artifact pair without optional files", async () => {
    const onAnalysis = vi.fn();
    const onError = vi.fn();

    await act(async () => {
      root.render(<FileUpload onAnalysis={onAnalysis} onError={onError} />);
    });

    const manifestInput = container.querySelector(
      "#manifest-input",
    ) as HTMLInputElement;
    const runResultsInput = container.querySelector(
      "#run-results-input",
    ) as HTMLInputElement;

    await setInputFile(manifestInput, createFile("manifest.json", "{}"));
    await setInputFile(
      runResultsInput,
      createFile("run_results.json", '{"results":[]}'),
    );

    await act(async () => {
      (
        container.querySelector("button.primary-action") as HTMLButtonElement
      ).click();
      await Promise.resolve();
    });

    expect(loadAnalysisFromBuffers).toHaveBeenCalledWith(
      expect.objectContaining({
        manifestBytes: expect.any(ArrayBuffer),
        runResultsBytes: expect.any(ArrayBuffer),
      }),
      "upload",
    );
    expect(loadAnalysisFromBuffers.mock.calls[0]?.[0]).not.toHaveProperty(
      "catalogBytes",
    );
    expect(loadAnalysisFromBuffers.mock.calls[0]?.[0]).not.toHaveProperty(
      "sourcesBytes",
    );
    expect(onAnalysis).toHaveBeenCalledTimes(1);
  });

  it("passes optional catalog and sources buffers when selected", async () => {
    await act(async () => {
      root.render(<FileUpload onAnalysis={vi.fn()} onError={vi.fn()} />);
    });

    await setInputFile(
      container.querySelector("#manifest-input") as HTMLInputElement,
      createFile("manifest.json", "{}"),
    );
    await setInputFile(
      container.querySelector("#run-results-input") as HTMLInputElement,
      createFile("run_results.json", '{"results":[]}'),
    );
    await setInputFile(
      container.querySelector("#catalog-input") as HTMLInputElement,
      createFile("catalog.json", '{"nodes":{}}'),
    );
    await setInputFile(
      container.querySelector("#sources-input") as HTMLInputElement,
      createFile("sources.json", '{"results":[]}'),
    );

    await act(async () => {
      (
        container.querySelector("button.primary-action") as HTMLButtonElement
      ).click();
      await Promise.resolve();
    });

    expect(loadAnalysisFromBuffers).toHaveBeenCalledWith(
      expect.objectContaining({
        manifestBytes: expect.any(ArrayBuffer),
        runResultsBytes: expect.any(ArrayBuffer),
        catalogBytes: expect.any(ArrayBuffer),
        sourcesBytes: expect.any(ArrayBuffer),
      }),
      "upload",
    );
  });
});
