import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const command = process.argv[2] === "start" ? "start" : "dev";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const host = process.env.WEB_HOST ?? process.env.HOST ?? "0.0.0.0";
const port = normalizePort(process.env.WEB_PORT ?? process.env.PORT ?? "3000");

const child = command === "start" ? spawnStandaloneServer() : spawnNextDevServer();

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

function spawnStandaloneServer() {
  const { standaloneRoot, standaloneServerPath } = resolveStandaloneServer();

  if (!existsSync(standaloneServerPath)) {
    const buildIdPath = join(appRoot, ".next", "BUILD_ID");

    if (existsSync(buildIdPath)) {
      return spawnNextProdServer();
    }

    throw new Error(`Next build is missing. Run "pnpm build" first.`);
  }

  syncStandaloneAsset(join(appRoot, ".next", "static"), join(standaloneRoot, ".next", "static"));
  syncStandaloneAsset(join(appRoot, "public"), join(standaloneRoot, "public"));

  return spawn(process.execPath, [standaloneServerPath], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      HOSTNAME: host,
      PORT: String(port),
    },
    stdio: "inherit",
  });
}

function spawnNextProdServer() {
  const nextBin = require.resolve("next/dist/bin/next");

  return spawn(process.execPath, [nextBin, "start", "--hostname", host, "--port", String(port)], {
    cwd: appRoot,
    env: process.env,
    stdio: "inherit",
  });
}

function resolveStandaloneServer() {
  const candidateRoots = [join(appRoot, ".next", "standalone"), join(appRoot, ".next", "standalone", "apps", "web")];

  for (const standaloneRoot of candidateRoots) {
    const standaloneServerPath = join(standaloneRoot, "server.js");

    if (existsSync(standaloneServerPath)) {
      return { standaloneRoot, standaloneServerPath };
    }
  }

  return {
    standaloneRoot: candidateRoots[1],
    standaloneServerPath: join(candidateRoots[1], "server.js"),
  };
}

function syncStandaloneAsset(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) {
    return;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath, { force: true, recursive: true });
}

function normalizePort(value) {
  const parsedPort = Number(value);

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    return 3000;
  }

  return parsedPort;
}
