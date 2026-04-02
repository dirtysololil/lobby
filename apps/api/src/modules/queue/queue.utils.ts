import type { ConnectionOptions } from 'bullmq';

export function getBullConnection(redisUrl: string): ConnectionOptions {
  const parsed = new URL(redisUrl);
  const databasePath = parsed.pathname.replace('/', '');

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: databasePath ? Number(databasePath) : 0,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}
