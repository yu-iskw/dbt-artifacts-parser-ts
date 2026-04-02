import { exec } from "node:child_process";
import { LISTEN_HOST, startServer } from "./serve.js";

const USAGE = `
Usage: dbt-tools-web [options]

  --target <dir>   Path to dbt target directory (sets DBT_TOOLS_TARGET_DIR)
  --port   <n>     Port to listen on (default: 3000)
  --no-open        Do not open the browser automatically
  --help           Show this help message
`.trimStart();

function parseArgs(argv: string[]): {
  targetDir: string | undefined;
  port: number;
  open: boolean;
} {
  let targetDir: string | undefined;
  let port = 3000;
  let open = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(USAGE);
      process.exit(0);
    } else if (arg === "--no-open") {
      open = false;
    } else if ((arg === "--target" || arg === "-t") && argv[i + 1]) {
      targetDir = argv[++i];
    } else if ((arg === "--port" || arg === "-p") && argv[i + 1]) {
      const parsed = parseInt(argv[++i], 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
        process.stderr.write(`Invalid port: ${argv[i]}\n`);
        process.exit(1);
      }
      port = parsed;
    }
  }

  return { targetDir, port, open };
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? `open ${url}`
      : process.platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open ${url}`;
  exec(cmd, (err) => {
    if (err) {
      // best-effort; silently ignore
    }
  });
}

const { targetDir, port, open } = parseArgs(process.argv.slice(2));

if (targetDir !== undefined) {
  process.env.DBT_TOOLS_TARGET_DIR = targetDir;
}

await startServer(port);

const url = `http://${LISTEN_HOST}:${port}`;
process.stdout.write(`dbt-tools-web  ${url}\n`);

if (open) {
  openBrowser(url);
}
