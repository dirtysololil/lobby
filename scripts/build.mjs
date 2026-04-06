import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(rootDir, "apps/api");
const webDir = path.join(rootDir, "apps/web");

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

async function runPowerShell(command, cwd = rootDir) {
  await run("powershell.exe", ["-NoProfile", "-Command", command], cwd);
}

await runPowerShell("& '.\\node_modules\\.bin\\prisma' generate --schema 'prisma/schema.prisma'");
await runPowerShell("& '.\\node_modules\\.bin\\tsc' -p 'packages/shared/tsconfig.build.json'");
await runPowerShell("& '.\\node_modules\\.bin\\tsc' -p 'packages/config/tsconfig.build.json'");
await runPowerShell("& '.\\node_modules\\.bin\\nest' build", apiDir);
await runPowerShell("& '.\\node_modules\\.bin\\next' build", webDir);
await run(process.execPath, ["scripts/prepare-standalone-assets.mjs"], webDir);
