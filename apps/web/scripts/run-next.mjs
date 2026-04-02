import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseWebEnv } = require("@lobby/config");

const env = parseWebEnv(process.env);
const command = process.argv[2] === "start" ? "start" : "dev";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");

const child =
  command === "start"
    ? spawnStandaloneServer()
    : spawnNextDevServer();

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

function spawnNextDevServer() {
  const nextBin = require.resolve("next/dist/bin/next");

  return spawn(
    process.execPath,
    [nextBin, "dev", "--hostname", env.WEB_HOST, "--port", String(env.WEB_PORT)],
    {
      cwd: appRoot,
      env: process.env,
      stdio: "inherit",
    },
  );
}

function spawnStandaloneServer() {
  const standaloneRoot = join(appRoot, ".next", "standalone", "apps", "web");
  const standaloneServerPath = join(standaloneRoot, "server.js");

  if (!existsSync(standaloneServerPath)) {
    throw new Error(
      `Standalone build is missing: ${standaloneServerPath}. Run "corepack pnpm build" first.`,
    );
  }

  syncStandaloneAsset(join(appRoot, ".next", "static"), join(standaloneRoot, ".next", "static"));
  syncStandaloneAsset(join(appRoot, "public"), join(standaloneRoot, "public"));

  return spawn(process.execPath, [standaloneServerPath], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      HOSTNAME: env.WEB_HOST,
      PORT: String(env.WEB_PORT),
    },
    stdio: "inherit",
  });
}

function syncStandaloneAsset(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) {
    return;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath, { force: true, recursive: true });
}
