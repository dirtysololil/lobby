import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
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
      shell: isWindows && command.toLowerCase().endsWith(".cmd"),
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

function getBinPath(name, cwd = rootDir) {
  return path.join(cwd, "node_modules", ".bin", isWindows ? `${name}.cmd` : name);
}

await run(getBinPath("prisma", rootDir), ["generate", "--schema", "prisma/schema.prisma"]);
await run(getBinPath("tsc", rootDir), ["-p", "packages/shared/tsconfig.build.json"]);
await run(getBinPath("tsc", rootDir), ["-p", "packages/config/tsconfig.build.json"]);
await rm(path.join(apiDir, "dist"), { recursive: true, force: true });
await run(getBinPath("nest", apiDir), ["build"], apiDir);
await rm(path.join(webDir, ".next"), { recursive: true, force: true });
await run(getBinPath("next", webDir), ["build"], webDir);
await run(process.execPath, ["scripts/prepare-standalone-assets.mjs"], webDir);
