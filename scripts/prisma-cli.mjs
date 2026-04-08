import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const prismaBin = path.join(
  rootDir,
  "node_modules",
  ".bin",
  isWindows ? "prisma.cmd" : "prisma",
);

const child = spawn(prismaBin, process.argv.slice(2), {
  cwd: rootDir,
  shell: isWindows,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
