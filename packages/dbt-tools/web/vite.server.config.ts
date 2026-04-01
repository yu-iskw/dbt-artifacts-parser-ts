import path from "path";
import { defineConfig } from "vite";

// Separate Vite build for the Node.js server/CLI entry (`npx @dbt-tools/web`).
// All npm dependencies and Node.js built-ins are externalized so they are
// resolved from node_modules at runtime; only the local web-package source is
// bundled into dist-serve/server/cli.js.
export default defineConfig({
  build: {
    outDir: "dist-serve",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "src/server/cli.ts"),
      external: [
        // Node.js built-ins
        /^node:/,
        // All npm packages (runtime deps already listed in package.json)
        /^@dbt-tools\//,
        /^dbt-artifacts-parser/,
        /^@aws-sdk\//,
        /^@google-cloud\//,
      ],
      output: {
        format: "es",
        entryFileNames: "server/[name].js",
        chunkFileNames: "server/[name]-[hash].js",
        banner: (chunk) =>
          chunk.name === "cli" ? "#!/usr/bin/env node" : "",
      },
    },
  },
  resolve: {
    alias: {
      "@web": path.resolve(__dirname, "src"),
    },
  },
});
