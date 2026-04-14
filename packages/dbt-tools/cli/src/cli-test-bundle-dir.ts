import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { getTestResourcePath } from "dbt-artifacts-parser/test-utils";

/**
 * Temp directory with standard dbt artifact names for CLI tests.
 */
export async function createJaffleArtifactBundleDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dbt-cli-bundle-"));
  await fs.copyFile(
    getTestResourcePath(
      "manifest",
      "v12",
      "resources",
      "jaffle_shop",
      "manifest_1.10.json",
    ),
    path.join(dir, "manifest.json"),
  );
  await fs.copyFile(
    getTestResourcePath(
      "run_results",
      "v6",
      "resources",
      "jaffle_shop",
      "run_results.json",
    ),
    path.join(dir, "run_results.json"),
  );
  return dir;
}
