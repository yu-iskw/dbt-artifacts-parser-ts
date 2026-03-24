// This file is superseded by the AnalysisWorkspace/ directory.
// It re-exports everything from there so that legacy import paths continue to
// resolve without a TypeScript error, while Vite and tsc both pick up this
// file (which takes priority over the directory when both exist).
export * from "./AnalysisWorkspace/index";
