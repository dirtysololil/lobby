import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const command = process.argv[2] === "start" ? "start" : "dev";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const host = process.env.WEB_HOST ?? process.env.HOST ?? "0.0.0.0";
const port = normalizePort(process.env.WEB_PORT ?? process.env.PORT ?? "3000");

const child = command === "start" ? spawnNextProdServer() : spawnNextDevServer();

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

function spawnNextDevServer() {
  const nextBin = require.resolve("next/dist/bin/next");

  return spawn(process.execPath, [nextBin, "dev", "--hostname", host, "--port", String(port)], {
    cwd: appRoot,
    env: process.env,
    stdio: "inherit",
  });
}

function spawnNextProdServer() {
  const buildIdPath = resolve(appRoot, ".next", "BUILD_ID");

  if (!existsSync(buildIdPath)) {
    throw new Error(`Next build is missing. Run "pnpm build" first.`);
  }

  const nextBin = require.resolve("next/dist/bin/next");

  return spawn(process.execPath, [nextBin, "start", "--hostname", host, "--port", String(port)], {
    cwd: appRoot,
    env: process.env,
    stdio: "inherit",
  });
}

function normalizePort(value) {
  const parsedPort = Number(value);

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    return 3000;
  }

  return parsedPort;
}
