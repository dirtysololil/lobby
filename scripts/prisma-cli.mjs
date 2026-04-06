import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function toPowerShellArg(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const cliArgs = process.argv.slice(2).map(toPowerShellArg).join(" ");
const command = `& '.\\node_modules\\.bin\\prisma' ${cliArgs}`.trim();

const child = spawn("powershell.exe", ["-NoProfile", "-Command", command], {
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
