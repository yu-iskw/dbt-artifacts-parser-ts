import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist-server",
    emptyOutDir: true,
    ssr: "src/server/serve.ts",
    rollupOptions: {
      external: [
        /^node:/,
        "commander",
        "@dbt-tools/core",
        "@aws-sdk/client-s3",
        "@google-cloud/storage",
      ],
      output: {
        format: "es",
        entryFileNames: "serve.js",
        banner: "#!/usr/bin/env node",
      },
    },
    target: "node22",
  },
});
