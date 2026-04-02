import { parseApiEnv } from '@lobby/config';
import { PrismaClient, UserRole } from '@prisma/client';
import {
  generateAccessKey,
  hashOpaqueToken,
} from '../src/modules/invites/invite-key.util';

function getArgValue(name: string): string | undefined {
  const argument = process.argv.find((item) => item.startsWith(`${name}=`));
  return argument ? argument.slice(name.length + 1) : undefined;
}

async function main(): Promise<void> {
  const env = parseApiEnv(process.env);
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });

  try {
    const rawAccessKey = generateAccessKey();
    const expiresInDays = Number(getArgValue('--expires-days') ?? '7');
    const expiresAt = Number.isFinite(expiresInDays)
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1_000)
      : null;

    await prisma.inviteKey.create({
      data: {
        codeHash: hashOpaqueToken(rawAccessKey, env.SESSION_SECRET, 'invite'),
        label: getArgValue('--label') ?? 'Bootstrap owner invite',
        role: UserRole.OWNER,
        maxUses: 1,
        expiresAt: expiresAt ?? undefined,
      },
    });

    console.log(`OWNER_ACCESS_KEY=${rawAccessKey}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
