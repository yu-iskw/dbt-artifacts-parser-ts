import { execFile } from "node:child_process";
import { LISTEN_HOST, startServer } from "./serve.js";
import { parseCliArgs, USAGE } from "./cli-args";

const parsed = parseCliArgs(process.argv.slice(2));
if (parsed.kind === "help") {
  process.stdout.write(USAGE);
  process.exit(0);
}
if (parsed.kind === "error") {
  process.stderr.write(`${parsed.message}\n`);
  process.exit(1);
}

const { targetDir, port, open } = parsed;

if (targetDir !== undefined) {
  process.env.DBT_TOOLS_TARGET_DIR = targetDir;
}

await startServer(port);

const url = `http://${LISTEN_HOST}:${port}`;
process.stdout.write(`dbt-tools-web  ${url}\n`);

function openBrowser(safeUrl: string): void {
  // safeUrl is always http://127.0.0.1:<port> from this process (numeric port).
  const cb = (): void => {
    /* best-effort */
  };
  if (process.platform === "darwin") {
    execFile("open", [safeUrl], cb);
  } else if (process.platform === "win32") {
    execFile(
      "cmd.exe",
      ["/c", "start", "", safeUrl],
      { windowsHide: true },
      cb,
    );
  } else {
    execFile("xdg-open", [safeUrl], cb);
  }
}

if (open) {
  openBrowser(url);
}
