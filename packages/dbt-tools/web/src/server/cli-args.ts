/** Pure CLI argument parsing for `dbt-tools-web` (testable without starting the server). */

export const USAGE = `
Usage: dbt-tools-web [options]

  --target <dir>   Path to dbt target directory (sets DBT_TOOLS_TARGET_DIR)
  --port   <n>     Port to listen on (default: 3000)
  --no-open        Do not open the browser automatically
  --help           Show this help message
`.trimStart();

export type ParsedCli =
  | { kind: "help" }
  | { kind: "error"; message: string }
  | {
      kind: "ok";
      targetDir: string | undefined;
      port: number;
      open: boolean;
    };

export function parseCliArgs(argv: string[]): ParsedCli {
  let targetDir: string | undefined;
  let port = 3000;
  let open = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) {
      break;
    }
    if (arg === "--help" || arg === "-h") {
      return { kind: "help" };
    }
    if (arg === "--no-open") {
      open = false;
      continue;
    }
    if (arg === "--target" || arg === "-t") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return {
          kind: "error",
          message: "Missing value for --target (or -t)",
        };
      }
      targetDir = next;
      i += 1;
      continue;
    }
    if (arg === "--port" || arg === "-p") {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        return {
          kind: "error",
          message: "Missing value for --port (or -p)",
        };
      }
      i += 1;
      const parsed = parseInt(next, 10);
      if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
        return { kind: "error", message: `Invalid port: ${next}` };
      }
      port = parsed;
      continue;
    }
    if (arg.startsWith("-")) {
      return { kind: "error", message: `Unknown option: ${arg}` };
    }
    return { kind: "error", message: `Unexpected argument: ${arg}` };
  }

  return { kind: "ok", targetDir, port, open };
}
