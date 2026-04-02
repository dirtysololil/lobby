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
      script: "corepack",
      args: "pnpm start:web",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
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
