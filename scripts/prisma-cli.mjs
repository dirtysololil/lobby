import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function quotePowerShellArg(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function quotePosixArg(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

const isWindows = process.platform === "win32";
const quoteArg = isWindows ? quotePowerShellArg : quotePosixArg;
const prismaBin = isWindows ? ".\\node_modules\\.bin\\prisma" : "./node_modules/.bin/prisma";
const cliArgs = process.argv.slice(2).map(quoteArg).join(" ");
const command = isWindows
  ? `& ${quoteArg(prismaBin)} ${cliArgs}`.trim()
  : `${quoteArg(prismaBin)} ${cliArgs}`.trim();
const shell = isWindows ? "powershell.exe" : "sh";
const shellArgs = isWindows
  ? ["-NoProfile", "-Command", command]
  : ["-lc", command];

const child = spawn(shell, shellArgs, {
  cwd: rootDir,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
