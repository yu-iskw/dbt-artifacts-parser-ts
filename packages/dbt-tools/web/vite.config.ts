import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dbtTargetPlugin } from "./dbt-target-plugin";

export default defineConfig({
  plugins: [dbtTargetPlugin(), react()],
  server: {
    port: 5173,
  },
  optimizeDeps: {
    include: [
      "dbt-artifacts-parser/manifest",
      "dbt-artifacts-parser/run_results",
      "@dbt-tools/core/browser",
    ],
  },
});
