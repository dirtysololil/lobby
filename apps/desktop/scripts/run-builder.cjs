const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

require("./prepare-config.cjs");
require("./prepare-icon.cjs");

function ensurePnpmShim() {
  const shimDir = path.join(os.tmpdir(), "lobby-desktop-corepack-shims");
  fs.mkdirSync(shimDir, { recursive: true });

  if (process.platform === "win32") {
    fs.writeFileSync(
      path.join(shimDir, "pnpm.cmd"),
      "@echo off\r\ncorepack pnpm %*\r\n",
      "utf8",
    );
  } else {
    const shimPath = path.join(shimDir, "pnpm");
    fs.writeFileSync(shimPath, "#!/usr/bin/env sh\ncorepack pnpm \"$@\"\n", "utf8");
    fs.chmodSync(shimPath, 0o755);
  }

  return shimDir;
}

const shimDir = ensurePnpmShim();
const env = {
  ...process.env,
  PATH: `${shimDir}${path.delimiter}${process.env.PATH || ""}`,
};

const command = process.platform === "win32" ? "electron-builder.cmd" : "electron-builder";
const child = spawn(command, process.argv.slice(2), {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

function copyConfigExample() {
  const sourcePath = path.resolve(__dirname, "..", "desktop.config.example.json");
  const distDir = path.resolve(__dirname, "..", "dist");
  const targetPath = path.join(distDir, "desktop.config.example.json");

  if (!fs.existsSync(sourcePath) || !fs.existsSync(distDir)) {
    return;
  }

  fs.copyFileSync(sourcePath, targetPath);
  console.log(`[desktop] copied ${path.relative(process.cwd(), targetPath)}`);
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  if (code === 0) {
    copyConfigExample();
  }

  process.exit(code ?? 1);
});
