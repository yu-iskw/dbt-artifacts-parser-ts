import path from "node:path";
import fs from "node:fs";
import type { Plugin } from "vite";

/**
 * Vite plugin that serves manifest.json and run_results.json from DBT_TARGET
 * during dev. Only active when DBT_TARGET is set and command is "serve".
 */
export function dbtTargetPlugin(): Plugin {
  return {
    name: "dbt-target",
    enforce: "pre",
    configureServer(server) {
      const raw = process.env.DBT_TARGET ?? "";
      const targetDir = raw
        .replace(/^~($|\/)/, `${process.env.HOME ?? ""}$1`)
        .trim();
      if (!targetDir) return;

      const cwd = process.cwd();
      const resolved = path.resolve(cwd, targetDir);

      if (!path.isAbsolute(targetDir)) {
        const relative = path.relative(cwd, resolved);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
          console.warn(
            "[dbt-target] DBT_TARGET resolved outside cwd, skipping:",
            resolved,
          );
          return;
        }
      }

      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
        console.warn("[dbt-target] DBT_TARGET is not a directory:", resolved);
        return;
      }

      if (process.env.DBT_DEBUG === "1") {
        console.log("[dbt-target] Serving artifacts from:", resolved);
      }

      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" || !req.url) return next();

        const pathname = req.url.split("?")[0];
        let filePath: string | null = null;
        if (pathname === "/api/manifest.json") {
          filePath = path.join(resolved, "manifest.json");
        } else if (pathname === "/api/run_results.json") {
          filePath = path.join(resolved, "run_results.json");
        }

        if (!filePath) return next();

        let status = 404;
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          res.setHeader("Content-Type", "application/json");
          res.statusCode = 200;
          status = 200;
          res.end(content);
        } catch {
          res.statusCode = 404;
          res.end();
        }
        if (process.env.DBT_DEBUG === "1") {
          console.log("[dbt-target] GET", pathname, "->", status, filePath);
        }
      });
    },
  };
}
