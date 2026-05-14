const { existsSync } = require("node:fs");

const node20Path = "/root/.npm/_npx/ebaba8b9e55fd0a9/node_modules/node/bin/node";
const nodeInterpreter = existsSync(node20Path) ? node20Path : "node";
const projectRoot = "/home/Dirtysolo/web/lobby.webmason.ru/public_html";
const webStandaloneServer = `${projectRoot}/apps/web/.next/standalone/apps/web/server.js`;

module.exports = {
  apps: [
    {
      name: "lobby-api",
      cwd: projectRoot,
      script: "/usr/local/bin/pnpm",
      args: "--filter @lobby/api start:prod",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "lobby-web",
      cwd: projectRoot,
      script: webStandaloneServer,
      interpreter: nodeInterpreter,
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "3000",
        WEB_PUBLIC_URL: process.env.WEB_PUBLIC_URL,
        API_PUBLIC_URL: process.env.API_PUBLIC_URL,
        NEXT_PUBLIC_WEB_PUBLIC_URL: process.env.WEB_PUBLIC_URL,
        NEXT_PUBLIC_API_PUBLIC_URL: process.env.API_PUBLIC_URL,
      },
    },
    {
      name: "lobby-worker",
      cwd: projectRoot,
      script: "/usr/local/bin/pnpm",
      args: "--filter @lobby/api start:worker",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
