import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(rootDir, "apps/api");
const webDir = path.join(rootDir, "apps/web");
const isWindows = process.platform === "win32";

function run(command, args, cwd = rootDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: ${command} ${args.join(" ")}`));
    });
  });
}

function quotePowerShellArg(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function quotePosixArg(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function quoteArg(value) {
  return isWindows ? quotePowerShellArg(value) : quotePosixArg(value);
}

function getShellCommand(command) {
  return isWindows
    ? { shell: "powershell.exe", args: ["-NoProfile", "-Command", command] }
    : { shell: "sh", args: ["-lc", command] };
}

async function runShellCommand(command, cwd = rootDir) {
  const shellCommand = getShellCommand(command);
  await run(shellCommand.shell, shellCommand.args, cwd);
}

function getBinPath(name) {
  return isWindows ? `.\\node_modules\\.bin\\${name}` : `./node_modules/.bin/${name}`;
}

function buildBinCommand(name, args = []) {
  const binPath = quoteArg(getBinPath(name));
  const serializedArgs = args.map(quoteArg).join(" ");

  if (isWindows) {
    return `& ${binPath}${serializedArgs ? ` ${serializedArgs}` : ""}`;
  }

  return `${binPath}${serializedArgs ? ` ${serializedArgs}` : ""}`;
}

await runShellCommand(
  buildBinCommand("prisma", ["generate", "--schema", "prisma/schema.prisma"]),
);
await runShellCommand(
  buildBinCommand("tsc", ["-p", "packages/shared/tsconfig.build.json"]),
);
await runShellCommand(
  buildBinCommand("tsc", ["-p", "packages/config/tsconfig.build.json"]),
);
await runShellCommand(buildBinCommand("nest", ["build"]), apiDir);
await runShellCommand(buildBinCommand("next", ["build"]), webDir);
await run(process.execPath, ["scripts/prepare-standalone-assets.mjs"], webDir);
