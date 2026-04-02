import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseWebEnv } = require("@lobby/config");

const env = parseWebEnv(process.env);
const command = process.argv[2] === "start" ? "start" : "dev";
const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(
  process.execPath,
  [nextBin, command, "--hostname", env.WEB_HOST, "--port", String(env.WEB_PORT)],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
