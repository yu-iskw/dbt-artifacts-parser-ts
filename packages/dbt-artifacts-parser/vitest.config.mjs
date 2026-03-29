import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: [".trunk/**", "node_modules/**"],
    pool: "threads",
  },
});
