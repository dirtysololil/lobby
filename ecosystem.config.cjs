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
      cwd: "/var/www/www-root/data/www/lobby",
      script: "node",
      args: "apps/web/.next/standalone/apps/web/server.js",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "3000"
      }
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
