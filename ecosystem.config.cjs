module.exports = {
  apps: [
    {
      name: "lobby-api",
      cwd: ".",
      script: "corepack",
      args: "pnpm start:api",
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
      cwd: ".",
      script: "apps/web/scripts/run-next.mjs",
      args: "start",
      interpreter: "node",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        WEB_HOST: "127.0.0.1",
        WEB_PORT: "3000",
      },
    },
    {
      name: "lobby-worker",
      cwd: ".",
      script: "corepack",
      args: "pnpm start:worker",
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
